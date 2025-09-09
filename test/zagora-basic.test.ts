// SPDX-License-Identifier: Apache-2.0

import { describe, expect, test } from "bun:test";
import { Zagora, zagora } from "../src/index.ts";
import { errorSchemas, valibotSchemas, zodSchemas } from "./helpers.ts";

describe("Zagora Basic Functionality", () => {
	test("should create Zagora instance with default config", () => {
		const instance = zagora();
		expect(instance).toBeInstanceOf(Zagora);
	});

	test("should create Zagora instance with custom config", () => {
		const config = { errorsFirst: true };
		const instance = zagora(config);
		expect(instance).toBeInstanceOf(Zagora);
	});

	test("should chain input method", () => {
		const instance = zagora().input(zodSchemas.string);
		expect(instance).toBeInstanceOf(Zagora);
	});

	test("should chain output method", () => {
		const instance = zagora()
			.input(zodSchemas.string)
			.output(zodSchemas.string);
		expect(instance).toBeInstanceOf(Zagora);
	});

	test("should chain errors method", () => {
		const instance = zagora()
			.input(zodSchemas.string)
			.output(zodSchemas.string)
			.errors(errorSchemas.single);

		expect(instance).toBeInstanceOf(Zagora);
	});

	test("should work with multiple error schemas", () => {
		const instance = zagora()
			.input(zodSchemas.string)
			.output(zodSchemas.string)
			.errors(errorSchemas.multiple);

		expect(instance).toBeInstanceOf(Zagora);
	});

	test("should work with Valibot schemas", () => {
		const instance = zagora()
			.input(valibotSchemas.string)
			.output(valibotSchemas.string);

		expect(instance).toBeInstanceOf(Zagora);
	});

	test("should work with complex object schemas", () => {
		const instance = zagora().input(zodSchemas.user).output(zodSchemas.user);

		expect(instance).toBeInstanceOf(Zagora);
	});

	test("should maintain immutability when chaining", () => {
		const base = zagora();
		const withInput = base.input(zodSchemas.string);
		const withOutput = withInput.output(zodSchemas.string);
		const withErrors = withOutput.errors(errorSchemas.single);

		// Each step should return a new instance
		expect(base).not.toBe(withInput);
		expect(withInput).not.toBe(withOutput);
		expect(withOutput).not.toBe(withErrors);
	});

	test("should throw error when handler called without input", () => {
		const instance = zagora();

		expect(() => {
			instance.handler(() => Promise.resolve("test"));
		}).toThrow(".input(...) must be called first");
	});

	test("should throw error when handler called without output", () => {
		const instance = zagora().input(zodSchemas.string);

		expect(() => {
			instance.handler(() => Promise.resolve("test"));
		}).toThrow(".output(...) must be called first");
	});

	test("should throw error when handlerSync called without input", () => {
		const instance = zagora();

		expect(() => {
			instance.handlerSync(() => "test");
		}).toThrow(".input(...) must be called first");
	});

	test("should throw error when handlerSync called without output", () => {
		const instance = zagora().input(zodSchemas.string);

		expect(() => {
			instance.handlerSync(() => "test");
		}).toThrow(".output(...) must be called first");
	});

	test("should allow method chaining in different orders", () => {
		// Test different valid orderings
		const instance1 = zagora()
			.input(zodSchemas.string)
			.output(zodSchemas.string)
			.errors(errorSchemas.single);

		const instance2 = zagora()
			.output(zodSchemas.string)
			.input(zodSchemas.string)
			.errors(errorSchemas.single);

		const instance3 = zagora()
			.errors(errorSchemas.single)
			.input(zodSchemas.string)
			.output(zodSchemas.string);

		expect(instance1).toBeInstanceOf(Zagora);
		expect(instance2).toBeInstanceOf(Zagora);
		expect(instance3).toBeInstanceOf(Zagora);
	});

	test("should work with array input schemas", () => {
		const instance = zagora()
			.input(zodSchemas.stringArray)
			.output(zodSchemas.stringArray);

		expect(instance).toBeInstanceOf(Zagora);
	});

	test("should work with tuple input schemas", () => {
		const instance = zagora()
			.input(zodSchemas.coordinates)
			.output(zodSchemas.number);

		expect(instance).toBeInstanceOf(Zagora);
	});

	test("should support Zod v4 new string formats", () => {
		const instance1 = zagora().input(zodSchemas.email).output(zodSchemas.email);

		const instance2 = zagora().input(zodSchemas.uuid).output(zodSchemas.uuid);

		const instance3 = zagora().input(zodSchemas.url).output(zodSchemas.url);

		expect(instance1).toBeInstanceOf(Zagora);
		expect(instance2).toBeInstanceOf(Zagora);
		expect(instance3).toBeInstanceOf(Zagora);
	});

	test("should support overriding schemas", () => {
		const instance1 = zagora()
			.input(zodSchemas.string)
			.input(zodSchemas.number); // Override input

		const instance2 = zagora()
			.output(zodSchemas.string)
			.output(zodSchemas.number); // Override output

		const instance3 = zagora()
			.errors(errorSchemas.single)
			.errors(errorSchemas.multiple); // Override errors

		expect(instance1).toBeInstanceOf(Zagora);
		expect(instance2).toBeInstanceOf(Zagora);
		expect(instance3).toBeInstanceOf(Zagora);

		// All instances should be valid Zagora instances
		expect(instance3).toBeInstanceOf(Zagora);
	});

	test("should work with errorsFirst config", () => {
		const instance = zagora({ errorsFirst: true })
			.input(zodSchemas.string)
			.output(zodSchemas.string)
			.errors(errorSchemas.single);

		expect(instance).toBeInstanceOf(Zagora);
	});

	test("should allow chaining without errors", () => {
		const instance = zagora()
			.input(zodSchemas.string)
			.output(zodSchemas.string);

		expect(instance).toBeInstanceOf(Zagora);
	});

	test("should work with mixed schema types", () => {
		const instance = zagora()
			.input(zodSchemas.user)
			.output(valibotSchemas.string);

		expect(instance).toBeInstanceOf(Zagora);
	});
});
