import { z } from "zod";
import { zagora } from "./src/index";

export type NewUser = z.infer<typeof NewUserSchema>;
export type User = z.infer<typeof UserSchema>;

export const NewUserSchema = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string(),
});

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
});

export type NewPlanet = z.infer<typeof NewPlanetSchema>;
export type UpdatePlanet = z.infer<typeof UpdatePlanetSchema>;
export type Planet = z.infer<typeof PlanetSchema>;

export const NewPlanetSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export const UpdatePlanetSchema = z.object({
  id: z.number().int().min(1),
  name: z.string(),
  description: z.string().optional(),
});

export const PlanetSchema = z.object({
  id: z.number().int().min(1),
  name: z.string(),
  description: z.string().optional(),
  imageUrl: z.url().optional(),
  creator: UserSchema,
});

export const listPlanets = zagora()
  .input(
    z.object({
      limit: z.number().int().min(1).max(100).default(10),
      cursor: z.number().int().min(0).default(0),
    }),
  )
  .output(z.array(PlanetSchema));

export const createPlanet = zagora()
  .input(NewPlanetSchema)
  .output(PlanetSchema);

// ============================================
// MIDDLEWARE & CONTEXT ROUTING
// ============================================

type Middleware<TContext = {}> = (args: {
  context: TContext;
  next: <TNewContext extends Record<string, any>>(payload: {
    context: TNewContext;
  }) => Promise<any>;
}) => Promise<any>;

class RouterBuilder<TContext = {}> {
  private middlewares: Middleware<any>[] = [];

  use<TNewContext extends Record<string, any>>(
    middleware: Middleware<TContext> &
      ((args: {
        context: TContext;
        next: (payload: { context: TNewContext }) => Promise<any>;
      }) => Promise<any>),
  ): RouterBuilder<TContext & TNewContext> {
    (this.middlewares as any[]).push(middleware);
    return this as any;
  }

  group<TProcedures extends Record<string, any>>(
    procedures: TProcedures,
  ): TProcedures {
    return Object.fromEntries(
      Object.entries(procedures).map(([key, proc]) => [
        key,
        this.redefineWithContext(proc),
      ]),
    ) as TProcedures;
  }

  private redefineWithContext = (procedure: any): any => {
    const def = procedure["~zagora"];

    const inputSchema = def.inputSchema;
    const outputSchema = def.outputSchema;
    const errorsSchema = def.errorsSchema;

    // Create wrapper input: { input: TInput, context: TContext }
    const wrappedInputSchema = z.object({
      input: inputSchema || z.any(),
      context: z.record(z.any(), z.any()).default({}),
    });

    let builder = zagora() as any;
    if (wrappedInputSchema) builder = builder.input(wrappedInputSchema);
    if (outputSchema) builder = builder.output(outputSchema);
    if (errorsSchema) builder = builder.errors(errorsSchema);

    return builder.handler(async ({ input, context }: any, errors: any) => {
      try {
        const finalContext = await this.executeMiddlewareChain(context);

        return def.handler({ input, context: finalContext, errors });
      } catch (error) {
        // If middleware throws, it will be caught by Zagora's error handling
        throw error;
      }
    });
  };

  private executeMiddlewareChain = async (
    initialContext: TContext,
  ): Promise<TContext> => {
    const executeChain = async (
      middlewareIndex: number,
      currentContext: any,
    ): Promise<any> => {
      if (middlewareIndex >= this.middlewares.length) {
        return currentContext;
      }

      const middleware = this.middlewares[middlewareIndex];

      try {
        return await middleware({
          context: currentContext,
          next: async (payload: { context: any }) => {
            return executeChain(middlewareIndex + 1, {
              ...currentContext,
              ...payload.context,
            });
          },
        });
      } catch (error) {
        // Middleware errors are thrown and will be caught by Zagora's error handling
        throw error;
      }
    };

    return executeChain(0, initialContext);
  };
}

function createRouter<TInitialContext = {}>(): RouterBuilder<TInitialContext> {
  return new RouterBuilder<TInitialContext>();
}

// ============================================
// EXAMPLE USAGE
// ============================================

const authed = createRouter()
  .use(async ({ context, next }) => {
    return next({
      context: {
        userId: "user-123",
        permissions: ["read", "write"],
      },
    });
  })
  .use(async ({ context, next }) => {
    if (!context.userId) {
      throw new Error("UNAUTHORIZED");
    }

    return next({
      context: {
        ...context,
        requestId: crypto.randomUUID(),
        timestamp: Date.now(),
      },
    });
  })
  .group({
    listPlanets: listPlanets.handler(async ({ input, context, errors }) => {
      return `context.db.planets.list(${input.limit}, ${input.cursor});`;
    }),
    createPlanet: createPlanet.handler(async ({ input, context, errors }) => {
      return `${input.name}-desc>>${input.description ?? "nope"}<<`;
    }),
  });

// Usage
// const result = await authed.listPlanets({
//   input: { limit: 10, cursor: 0 },
//   context: {},
// });
