import { z } from "zod";

// Tuple schemas with optional elements work correctly with rest parameters
// Just use z.infer<typeof schema> directly - no conversion needed

const userSchema = z.tuple([z.string(), z.number().optional()]);
type UserInput = z.infer<typeof userSchema>;

function handleUser(...args: UserInput): void {
  const [id, age] = args;
  console.log(`User ${id}, age ${age ?? "unknown"}`);
}

handleUser("user1");
handleUser("user1", 30);

// Complex example with multiple optionals
const querySchema = z.tuple([
  z.string(),
  z.number().optional(),
  z.boolean(),
  z.string().optional(),
]);
type QueryInput = z.infer<typeof querySchema>;

function executeQuery(...args: QueryInput): void {
  const [query, limit = 10, cache, tag] = args;
  console.log(`Query: ${query}, limit: ${limit}, cache: ${cache}, tag: ${tag}`);
}

executeQuery("SELECT *", 20, true, "results");
executeQuery("SELECT *", undefined, true, "results");
executeQuery("SELECT *", 20, true);
executeQuery("SELECT *", true as any); // Type error - correct

// With runtime validation
function parseAndHandle(input: unknown): void {
  const result = querySchema.safeParse(input);
  if (result.success) {
    const handler = (...args: QueryInput) => {
      console.log("Handled:", args);
    };
    handler(...result.data);
  }
}

parseAndHandle(["SELECT *", 20, true, "tag"]);
parseAndHandle(["SELECT *", true]);
