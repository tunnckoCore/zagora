import * as v from "valibot";
import { zagora } from "../src/index.ts";

const asyncSchema = v.pipeAsync(
  v.string(),
  v.checkAsync(async (value) => value.length > 2),
);

const syncSchema = v.string()

const syncProcedureAsyncSchema = zagora()
  .input(asyncSchema)
  .handler((_, value) => value.toUpperCase())
  .callable();

const syncProcedureSyncSchema = zagora()
  .input(syncSchema)
  .handler((_, value) => value.toUpperCase())
  .callable();

const asyncProcedure = zagora()
  .input(syncSchema)
  .handler(async (_, value) => value.toUpperCase())
  .callable();

// typed as Promise<ZagoraResult>
const promiseResult = syncProcedureAsyncSchema("hello");
promiseResult.then();
// @ts-expect-error - it's a promise
promiseResult.ok;

// typed as ZagoraResult
const syncProdcedureAsyncResult = await syncProcedureAsyncSchema("hello");
// @ts-expect-error - it's a result, not a promise
syncProdcedureAsyncResult.then();
syncProdcedureAsyncResult.ok;

const syncResult = syncProcedureSyncSchema("hello");
syncResult.ok;

const asyncResult = await asyncProcedure("hello");
asyncResult.ok;

// @ts-expect-error - it's result, because it was awaited
asyncResult.then()