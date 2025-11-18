import z from "zod";
import { zagora } from "./src/index";

const planets = [
  {
    id: 1,
    name: "Mercury",
    description: "The smallest planet in our solar system",
    imageUrl: "https://example.com/mercury.jpg",
  },
  {
    id: 2,
    name: "Venus",
    description: "The second planet from the Sun",
    imageUrl: "https://example.com/venus.jpg",
  },
  {
    id: 3,
    name: "Earth",
    description: "The third planet from the Sun",
    imageUrl: "https://example.com/earth.jpg",
  },
  {
    id: 4,
    name: "Mars",
    description: "The fourth planet from the Sun",
    imageUrl: "https://example.com/mars.jpg",
  },
  {
    id: 5,
    name: "Jupiter",
    description: "The fifth planet from the Sun",
    imageUrl: "https://example.com/jupiter.jpg",
  },
  {
    id: 6,
    name: "Saturn",
    description: "The sixth planet from the Sun",
    imageUrl: "https://example.com/saturn.jpg",
  },
  {
    id: 7,
    name: "Uranus",
    description: "The seventh planet from the Sun",
    imageUrl: "https://example.com/uranus.jpg",
  },
  {
    id: 8,
    name: "Neptune",
    description: "The eighth planet from the Sun",
    imageUrl: "https://example.com/neptune.jpg",
  },
];

export const NewPlanetSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
});

export const PlanetSchema = z.object({
  id: z.number().int().min(1),
  name: z.string(),
  description: z.string().optional(),
  imageUrl: z.url().optional(),
});

const za = zagora();

console.log("instance before", { za });

const listPlanets = za
  .input(
    z.object({
      limit: z.number().int().min(1).max(100).default(10),
      cursor: z.number().int().min(0).default(0),
    }),
  )
  .output(z.array(PlanetSchema))
  // TODO: fix `limit` and `cursor` being typed as `number | undefined`
  // while there is default set in the schema...
  .handler(async ({ limit, cursor }) => {
    const result = planets.slice(cursor, Number(cursor) + Number(limit));
    console.log("list planets...");
    return result;
  });

console.log("instance after list", { za });

const createPlanet = za
  .input(NewPlanetSchema)
  .output(PlanetSchema)
  .handler(async ({ name, description }) => {
    const id = planets.length + 1;
    const imageUrl = `https://example.com/${name.toLowerCase()}.jpg`;
    const newPlanet = { id, name, description: description || "", imageUrl };
    planets.push(newPlanet);
    console.log("create planet...");

    return newPlanet;
  });

const listRes = await listPlanets({});
const createRes = await createPlanet({
  name: "Pluto",
  description: "The ninth planet from the Sun",
});

console.log({ listRes: listRes.data, createRes: createRes.data });
