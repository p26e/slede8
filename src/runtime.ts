const RECURSION_LIMIT = 1000;

const ERROR_MESSAGE = {
	segmentationFault: "Segmenteringsfeil",
	recursionLimitExceeded: "Alt for mange funksjonskall inni hverandre",
	fileSizeTooBig: "Programmet får ikke plass i minnet",
	readAfterEndOfInput: "Programmet gikk tom for føde",
	unsupportedExecutable: "Dette skjønner jeg ingenting av",
	resourcesExhausted: (maxTicks: number) =>
		`Programmet ble brutalt drept etter å ha benyttet hele ${maxTicks} sykluser`,
};

type Instruction = {
	operationClass: number;
	operation: number;
	address: number;
	value: number;
	argument1: number;
	argument2: number;
};

function readInstruction(memorySlice: Uint8Array): Instruction {
	const instruction = new DataView(memorySlice.buffer).getUint16(0, true);
	return {
		operationClass: instruction & 0xf,
		operation: (instruction >> 4) & 0xf,
		address: instruction >> 4,
		value: instruction >> 8,
		argument1: (instruction >> 8) & 0xf,
		argument2: (instruction >> 12) & 0xf,
	};
}

function load(executable: Uint8Array) {
	if (executable.byteLength > 4096) {
		throw ERROR_MESSAGE.fileSizeTooBig;
	}

	const magic = new TextDecoder("utf-8").decode(executable.slice(0, 7));
	if (magic !== ".SLEDE8") throw ERROR_MESSAGE.unsupportedExecutable;

	const memory = new Uint8Array(4096);
	let seek = 7;
	let i = 0;
	while (seek < executable.byteLength) {
		memory[i++] = executable[seek++];
	}
	return memory;
}

export type State = {
	pc: number;
	flag: boolean;
	regs: Uint8Array;
	memory: Uint8Array;
	stdout: Uint8Array;
	inputPtr: number;
};

export function* step(
	executable: Uint8Array,
	stdin: Uint8Array,
	maxTicks = 1000
): Generator<State, State> {
	let inputPtr = 0;
	let tick = 0;

	let pc = 0;
	let flag = false;
	const regs = new Uint8Array(16);
	const memory = load(executable);
	let stdout = new Uint8Array();
	const backtrace: number[] = [];

	while (pc < memory.byteLength) {
		if (++tick > maxTicks) throw ERROR_MESSAGE.resourcesExhausted(maxTicks);

		yield { pc, flag, regs, memory, stdout, inputPtr };

		const instr = readInstruction(memory.slice(pc, pc + 2));
		pc += 2;

		// HALT
		if (instr.operationClass === 0x0) break;
		// SET
		else if (instr.operationClass === 0x1) {
			regs[instr.operation] = instr.value;
		} else if (instr.operationClass === 0x2) {
			regs[instr.operation] = regs[instr.argument1];
		}

		// FINN
		else if (instr.operationClass === 0x3) {
			regs[1] = (instr.address & 0x0f00) >> 8;
			regs[0] = instr.address & 0xff;
		}

		// LOAD / STORE
		else if (instr.operationClass === 0x4) {
			const addr = ((regs[1] << 8) | regs[0]) & 0xfff;
			if (instr.operation === 0) regs[instr.argument1] = memory[addr];
			else if (instr.operation === 1) memory[addr] = regs[instr.argument1];
			else throw ERROR_MESSAGE.segmentationFault;
		}

		// ALU
		else if (instr.operationClass === 0x5) {
			const reg1 = regs[instr.argument1];
			const reg2 = regs[instr.argument2];

			if (instr.operation === 0x0) regs[instr.argument1] &= reg2;
			else if (instr.operation === 0x1) regs[instr.argument1] |= reg2;
			else if (instr.operation === 0x2) regs[instr.argument1] ^= reg2;
			else if (instr.operation === 0x3)
				regs[instr.argument1] = (reg1 << reg2) & 0xff;
			else if (instr.operation === 0x4) regs[instr.argument1] >>= reg2;
			else if (instr.operation === 0x5)
				regs[instr.argument1] = (reg1 + reg2) & 0xff;
			else if (instr.operation === 0x6)
				regs[instr.argument1] = (reg1 - reg2) & 0xff;
			else throw ERROR_MESSAGE.segmentationFault;
		}

		// I/O
		else if (instr.operationClass === 0x6) {
			// READ
			if (instr.operation === 0x0) {
				if (stdin.length > inputPtr) {
					regs[instr.argument1] = stdin[inputPtr++];
				} else {
					throw ERROR_MESSAGE.readAfterEndOfInput;
				}
			}

			// WRITE
			else if (instr.operation === 0x1) {
				stdout = new Uint8Array([...stdout, regs[instr.argument1]]);
			} else throw ERROR_MESSAGE.segmentationFault;
		}

		// CMP
		else if (instr.operationClass === 0x7) {
			const reg1 = regs[instr.argument1];
			const reg2 = regs[instr.argument2];

			if (instr.operation === 0x0) flag = reg1 === reg2;
			else if (instr.operation === 0x1) flag = reg1 !== reg2;
			else if (instr.operation === 0x2) flag = reg1 < reg2;
			else if (instr.operation === 0x3) flag = reg1 <= reg2;
			else if (instr.operation === 0x4) flag = reg1 > reg2;
			else if (instr.operation === 0x5) flag = reg1 >= reg2;
			else throw ERROR_MESSAGE.segmentationFault;
		}

		// JMP
		else if (instr.operationClass === 0x8) pc = instr.address;
		// COND JMP
		else if (instr.operationClass === 0x9) {
			if (flag) {
				pc = instr.address;
			}
		}

		// CALL
		else if (instr.operationClass === 0xa) {
			if (backtrace.length >= RECURSION_LIMIT)
				throw ERROR_MESSAGE.recursionLimitExceeded;
			backtrace.push(pc);
			pc = instr.address;
		}

		// RET
		else if (instr.operationClass === 0xb) {
			pc = backtrace.pop() ?? NaN;
			if (isNaN(pc)) throw ERROR_MESSAGE.segmentationFault;
		} else if (instr.operationClass === 0xc) continue;
		else throw ERROR_MESSAGE.segmentationFault;
	}

	return { pc, flag, regs, memory, stdout, inputPtr };
}
