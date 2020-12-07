import { __internals } from "./assembler";

describe("isVal", () => {
	test("returnValue", () => {
		const isVal = __internals.isVal;
		expect(isVal(".DATA")).toBe(false);
		expect(isVal("label:")).toBe(false);
		expect(isVal("0x44")).toBe(true);
		expect(isVal("0.5")).toBe(false);
		expect(isVal("22")).toBe(true);
		expect(isVal(`"hello"`)).toBe(false);
		expect(isVal("0x0a")).toBe(true);
	});
});

describe("getVal", () => {
	test("returnValue", () => {
		const getVal = __internals.getVal;
		expect(getVal("0xff")).toBe(0xff);
		expect(getVal("0x31")).toBe(0x31);
		expect(getVal("99")).toBe(99);
		expect(getVal("0x99")).toBe(0x99);
		expect(getVal("0x0a")).toBe(0x0a);
	});
});

describe("getReg", () => {
	test("returnValue", () => {
		const getReg = __internals.getReg;
		expect(getReg("r0")).toBe(0);
		expect(getReg("r1")).toBe(1);
		expect(getReg("r9")).toBe(9);
		expect(getReg("r10")).toBe(10);
		expect(getReg("r15")).toBe(15);
	});
});

describe("preprocess", () => {
	const preprocess = __internals.preprosess;
	const sourceCode = `

; comment first

	START_OF_FILE:
	ADD 1, 1
	BEFORE_COMMENT:  
; comment 
	MOV 0, 4


	ADD 2, 3
HELLO:
RET`;
	test("labels", () => {
		const { labels } = preprocess(sourceCode);
		expect(labels.START_OF_FILE).toBe(0);
		expect(labels.BEFORE_COMMENT).toBe(2);
		expect(labels.HELLO).toBe(6);
	});

	test("instructions", () => {
		const { instructions } = preprocess(sourceCode);
		expect(instructions.length).toBe(4);
		expect(instructions[0].lineNumber).toBe(5);
		expect(instructions[0].raw).toBe("ADD 1, 1");
		expect(instructions[1].lineNumber).toBe(8);
		expect(instructions[1].raw).toBe("MOV 0, 4");
		expect(instructions[2].lineNumber).toBe(11);
		expect(instructions[2].raw).toBe("ADD 2, 3");
		expect(instructions[3].lineNumber).toBe(13);
		expect(instructions[3].raw).toBe("RET");
	});
});

describe("tokenize", () => {
	const f_ = __internals.tokenize;
	test("opCode", () => {
		expect(f_("LST 0x31, 31").opCode).toBe("LST");
		expect(f_("SKR; 0x31, 31").opCode).toBe("SKR");
		expect(f_("ADD 0x31;, 31").opCode).toBe("ADD");
		expect(f_("SUB 13").opCode).toBe("SUB");
	});
	test("args", () => {
		expect(f_("ADD 0x31, 31").args).toStrictEqual(["0x31", "31"]);
		expect(f_("ADD; 0x31, 31").args).toStrictEqual([]);
		expect(f_("ADD 0x31;, 31").args).toStrictEqual(["0x31"]);
		expect(f_("ADD 13").args).toStrictEqual(["13"]);
	});
});
