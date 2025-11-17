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

/////////
///////// EXAMPLE PROCEDURES (contract-based)
/////////

export const listPlanets = zagora()
  .input(
    z.object({
      limit: z.number().int().min(1).max(100).default(10),
      cursor: z.number().int().min(0).default(0),
    }),
  )
  .output(z.array(PlanetSchema));
// .handler(async (input) => {
//   return `context.db.planets.list(${input.limit}, ${input.cursor});`;
// });

export const createPlanet = zagora()
  .input(NewPlanetSchema)
  .output(PlanetSchema);
// .handler(async (input) => {
//   return `${input.name}-desc>>${input.description ?? "nope"}<<`;
// });

const procedures = {
  listPlanets,
  createPlanet,
};

const middlewares = [fn1, fn2];

const planetsGroup = group(middlewares, procedures);

// router.listPlanets({});

function group<TContext, TProcedures>(
  middlewares: TMiddleware<TContext>[],
  handlers: TProcedures,
) {}
