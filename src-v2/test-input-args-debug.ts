import { z } from "zod";
import { zagora } from "./index";

// Create a simple tuple schema
const tupleSchema = z.tuple([z.string(), z.number()]);

// Build the procedure
const pub = zagora().input(tupleSchema).output(z.string());

// Now create the handler and see what type it expects
const handler = pub.handler((name, id) => {
  return `${name}-${id}`;
});

// The fact that handler is 'never' means ForwardType is resolving to 'never'
// This means either:
// 1. InputArgs is not matching readonly [any, ...any[]]
// 2. TupleForwardOverloads is returning never

// Let's check what the inferred input type is from the schema
type SchemaInput = z.infer<typeof tupleSchema>;
// This should be: readonly [string, number]

// Check if it matches the tuple pattern
type MatchesTuplePattern = SchemaInput extends readonly [any, ...any[]]
  ? true
  : false;

// This should be: true

// The issue is that even though the pattern should match,
// something in the handler type inference is breaking it.
//
// Hypothesis: Maybe the issue is with how StandardSchemaV1 wraps the schema?
// Let me check if the issue is in InferSchemaInput

import type { InferSchemaInput } from "./types";

type InferredInput = InferSchemaInput<typeof tupleSchema>;
// This should also be: readonly [string, number]

type MatchesInferred = InferredInput extends readonly [any, ...any[]]
  ? true
  : false;
// This should be: true

// The problem might be that in the handler context, the type is being
// widened to an array or something else entirely.
