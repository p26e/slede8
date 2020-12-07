import typescript from "rollup-plugin-typescript2";
import pkg from "./package.json";
import copy from "rollup-plugin-copy";

export default [
	{
		input: "src/index.ts",
		output: [
			{
				file: `lib/${pkg.main}`,
				format: "cjs",
			},
			{
				file: `lib/${pkg.module}`,
				format: "esm",
			},
		],
		plugins: [
			typescript(),
			copy({
				targets: [
					{ src: "package.json", dest: "lib" },
					{ src: "README.md", dest: "lib" },
					{ src: "LICENSE", dest: "lib" },
				],
			}),
		],
	},
];
