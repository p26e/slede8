type Labels = {
	[label: string]: number;
};

export type InstructionInfo = {
	lineNumber: number;
	address: number;
	raw: string;
};

type SourceMap = {
	instructions: InstructionInfo[];
	labels: Labels;
};

export type Instruction = {
	opCode: string;
	args: string[];
};

export type DebugInfo = {
	[address: number]: InstructionInfo;
};

export type Target = {
	exe: Uint8Array;
	pdb: DebugInfo;
};

const ERROR_MESSAGE = {
	expectedNoArguments: (extra = "") => `Forventet ingen argumenter. ${extra}`,
	expectedOneArgument: (extra = "") => `Forventet ett argument. ${extra}`,
	expectedTwoArguments: (extra = "") => `Forventet to argumenter. ${extra}`,
	unexpectedToken: (token: string) => `Skjønner ikke hva dette er: '${token}'`,
	invalidRegistry: (reg: string) => `Ugyldig register: '${reg}'`,
};

function classify(
	line: string
): "label" | "instruction" | "data" | "comment" | "whitespace" {
	if (line.length === 0) return "whitespace";
	if (line.match(/^;.*$/)) return "comment";
	if (line.match(/^[0-9a-zA-ZæøåÆØÅ\-_]+:$/)) return "label";
	if (line.match(/^.DATA [x0-9a-fA-F, ]*$/)) return "data";
	return "instruction";
}

function preprosess(sourceCode: string): SourceMap {
	let address = 0;
	return sourceCode.split("\n").reduce(
		(prev, current, lineNumber) => {
			const line = current.trim();
			const { instructions, labels } = prev;
			switch (classify(line)) {
				case "label":
					labels[line.slice(0, -1)] = address;
					return { instructions, labels };
				case "data":
					instructions.push({ lineNumber, address, raw: line });
					address += tokenize(line).args.length;
					return { labels, instructions };
				case "instruction":
					instructions.push({ lineNumber, address, raw: line });
					address += 2;
					return { labels, instructions };
				default:
					return { labels, instructions };
			}
		},
		{
			instructions: [],
			labels: {},
		} as SourceMap
	);
}

function tokenize(raw: string): Instruction {
	const commentsRemoved = raw.trim().split(";")[0];
	const [opCode, ...rest] = commentsRemoved
		.split(" ")
		.map((x) => x.trim())
		.filter((x) => x.length > 0);
	const args = (rest || [])
		.join("")
		.split(",")
		.map((x) => x.trim())
		.filter((x) => x.length > 0);
	return { opCode, args };
}

function translate(instruction: Instruction, labels: Labels): Uint8Array {
	const { opCode, args } = instruction;
	if (instruction.opCode === ".DATA") {
		return new Uint8Array(args.map(getVal));
	}

	const ensureNoArgs = () => {
		if (args.length > 0)
			throw ERROR_MESSAGE.expectedNoArguments(
				`${instruction.opCode}: ${instruction.args}`
			);
	};

	const singleArg = () => {
		if (args.length !== 1)
			throw ERROR_MESSAGE.expectedOneArgument(
				`${instruction.opCode}: ${instruction.args}`
			);
		return args[0];
	};

	const twoArguments = () => {
		if (args.length !== 2)
			throw ERROR_MESSAGE.expectedTwoArguments(
				`${instruction.opCode}: ${instruction.args}`
			);
		return args as [string, string];
	};

	const aluOps = [
		"OG",
		"ELLER",
		"XELLER",
		"VSKIFT",
		"HSKIFT",
		"PLUSS",
		"MINUS",
	];
	const cmpOps = ["LIK", "ULIK", "ME", "MEL", "SE", "SEL"];
	switch (instruction.opCode) {
		case "STOPP":
			ensureNoArgs();
			return writeHalt();
		case "SETT":
			return writeSet(twoArguments());

		case "FINN":
			return writeLocate(singleArg(), labels);
		case "LAST":
			return writeLoad(singleArg());
		case "LAGR":
			return writeStore(singleArg());

		// ALU
		case "OG":
		case "ELLER":
		case "XELLER":
		case "VSKIFT":
		case "HSKIFT":
		case "PLUSS":
		case "MINUS":
			return writeAlu(aluOps.indexOf(opCode), twoArguments());

		// I/O
		case "LES":
			return writeRead(singleArg());
		case "SKRIV":
			return writeWrite(singleArg());

		// CMP
		case "LIK":
		case "ULIK":
		case "ME":
		case "MEL":
		case "SE":
		case "SEL":
			return writeCmp(cmpOps.indexOf(opCode), twoArguments());

		case "HOPP":
			return writeJmp(8, singleArg(), labels);
		case "BHOPP":
			return writeJmp(9, singleArg(), labels);
		case "TUR":
			return writeCall(singleArg(), labels);
		case "RETUR":
			ensureNoArgs();
			return writeRet();
		case "NOPE":
			ensureNoArgs();
			return writeNop();
		default:
			throw ERROR_MESSAGE.unexpectedToken(opCode);
	}
}

export function assemble(sourceCode: string): Target {
	const sourceMap = preprosess(sourceCode);
	const instructions = sourceMap.instructions.map((instr) => {
		const instruction = tokenize(instr.raw);
		return translate(instruction, sourceMap.labels);
	});
	const magic = new Uint8Array([0x2e, 0x53, 0x4c, 0x45, 0x44, 0x45, 0x38]);
	const exe = concat(...[magic, ...instructions]);
	const pdb: DebugInfo = sourceMap.instructions.reduce(
		(prev, instr) => ({ ...prev, [instr.address]: instr }),
		{}
	);
	return { exe, pdb };
}

function concat(...buffers: Uint8Array[]): Uint8Array {
	const totalLength = buffers.reduce((acc, value) => acc + value.length, 0);
	if (!buffers.length) return new Uint8Array([]);
	const result = new Uint8Array(totalLength);

	let length = 0;
	for (const array of buffers) {
		result.set(array, length);
		length += array.length;
	}

	return result;
}

function u16(value: number): Uint8Array {
	return new Uint8Array([value & 0xff, (value & 0xff00) >> 8]);
}

function nibs(
	nib1: number,
	nib2: number,
	nib3: number,
	nib4: number
): Uint8Array {
	return u16(nib1 | (nib2 << 4) | (nib3 << 8) | (nib4 << 12));
}

function nibsByte(nib1: number, nib2: number, byte: number): Uint8Array {
	return u16(nib1 | (nib2 << 4) | (byte << 8));
}

function nibVal(nib: number, val: number): Uint8Array {
	return u16(nib | (val << 4));
}

function isVal(valStr: string): boolean {
	if (isNaN(+valStr)) return false;
	return valStr.slice(2) === "0x"
		? +valStr === parseInt(valStr, 16)
		: +valStr === parseInt(valStr);
}

function getVal(valStr: string): number {
	return +valStr;
}

function getReg(regStr: string): number {
	if (regStr[0] !== "r") throw ERROR_MESSAGE.invalidRegistry(regStr);
	const regNum = parseInt(regStr.slice(1));
	if (regNum < 0 || regNum > 15) throw ERROR_MESSAGE.invalidRegistry(regStr);
	return regNum;
}

function getAddr(addrStr: string, labels: Labels): number {
	if (isVal(addrStr)) {
		return getVal(addrStr);
	}
	if (labels[addrStr] === undefined) {
		throw ERROR_MESSAGE.unexpectedToken(addrStr);
	}
	return labels[addrStr];
}

function writeHalt(): Uint8Array {
	return u16(0);
}

function writeSet(args: [string, string]): Uint8Array {
	const [reg1, regOrValue] = args;
	const reg1Num = getReg(reg1);
	if (isVal(regOrValue)) {
		const value = getVal(regOrValue);
		return nibsByte(1, reg1Num, value);
	} else {
		const reg2Num = getReg(regOrValue);
		return nibsByte(2, reg1Num, reg2Num);
	}
}

function writeLocate(arg: string, labels: Labels) {
	const addr = getAddr(arg, labels);
	return nibVal(3, addr);
}

function writeLoad(reg: string): Uint8Array {
	const regNum = getReg(reg);
	return nibs(4, 0, regNum, 0);
}

function writeStore(reg: string): Uint8Array {
	const regNum = getReg(reg);
	return nibs(4, 1, regNum, 0);
}

function writeAlu(aluOp: number, args: [string, string]): Uint8Array {
	const [reg1, reg2] = args;
	const reg1Num = getReg(reg1);
	const reg2Num = getReg(reg2);
	return nibs(5, aluOp, reg1Num, reg2Num);
}

function writeRead(arg: string): Uint8Array {
	const reg = arg.trim();
	const regNum = getReg(reg);
	return nibs(6, 0, regNum, 0);
}

function writeWrite(arg: string): Uint8Array {
	const reg = arg.trim();
	const regNum = getReg(reg);
	return nibs(6, 1, regNum, 0);
}

function writeCmp(cmpOp: number, args: [string, string]): Uint8Array {
	const [reg1, reg2] = args;
	const reg1Num = getReg(reg1);
	const reg2Num = getReg(reg2);
	return nibs(7, cmpOp, reg1Num, reg2Num);
}

function writeJmp(jmpOp: number, arg: string, labels: Labels): Uint8Array {
	return nibVal(jmpOp, getAddr(arg, labels));
}

function writeCall(arg: string, labels: Labels): Uint8Array {
	return nibVal(0xa, getAddr(arg, labels));
}

function writeRet(): Uint8Array {
	return u16(0xb);
}

function writeNop(): Uint8Array {
	return u16(0xc);
}

export const __internals = {
	u16,
	nibs,
	nibsByte,
	nibVal,
	isVal,
	getVal,
	getAddr,
	getReg,

	preprosess,
	tokenize,
};
