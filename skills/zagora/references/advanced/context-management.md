# Context Management

Context allows you to inject dependencies like databases, request/response, services, loggers, user auth data, or configuration into handlers.

## Setting Initial Context

Use `.context()` to define initial context:

```ts
const getUser = zagora()
  .context({ 
    db: myDatabase,
    logger: console
  })
  .input(z.string())
  .handler(({ context }, userId) => {
    context.logger.log('Fetching user:', userId);
    return context.db.findUser(userId);
  })
  .callable();
```

## Runtime Context Override

Override or extend context at call site via `.callable()`:

```ts
const getUser = zagora()
  .context({ db: productionDb })
  .input(z.string())
  .handler(({ context }, userId) => context.db.findUser(userId))

// Use production db
getUser.callable()('foobar');

// Override with test db
const testGetUser = getUser.callable({ 
  context: { db: testDb } 
});
testGetUser('foobar');
```

## Context Merging

Runtime context is deep-merged with initial context:

```ts
const proc = zagora()
  .context({ 
    db: myDb,
    config: { timeout: 5000 }
  })
  .handler(({ context }) => {
    console.log(context.db);      // myDb
    console.log(context.config);  // { timeout: 5000 }
    console.log(context.extra);   // 'value'
  })
  .callable({ 
    context: { extra: 'value', config: { greet: 'hello' } } 
  });

// Handler sees merged context:
// { db: myDb, config: { timeout: 5000, greet: 'hello' }, extra: 'value' }
```

## TypeScript Inference

Context is fully typed:

```ts
const proc = zagora()
  .context({ db: myDatabase })
  .handler(({ context }) => {
    context.db;      // typeof myDatabase
    
    // @ts-expect-error -- unknown properties are reported by TypeScript!
    context.other;
  })
  .callable();
```

With runtime context:

```ts
const proc = zagora()
  .context({ db: myDatabase })
  .handler(({ context }) => {
    context.db;      // typeof myDatabase
    context.logger;  // Logger (from runtime)
  })
  .callable({ context: { logger: myLogger } });
```

Alternatively, you can pass a generic to the `.context` call to force the type it expects.

```ts
zagora()
  .context<{ db: typeof myProdDb }>({ db: myProdDb })
  .handler(({ context }) => context.db.findOne('foobar'));
```

## Pattern: Dependency Injection

Use context for clean dependency injection:

```ts
const createUser = zagora()
  .input(z.object({ name: z.string(), email: z.string() }))
  .handler(async ({ context }, input) => {
    const user = await context.userService.create(input);
    await context.emailService.sendWelcome(user.email);
    context.analytics.track('user_created', { userId: user.id });
    return user;
  });

// Production
const prodCreateUser = createUser.callable({
  context: {
    userService: new UserService(prodDb),
    emailService: new EmailService(sendgrid),
    analytics: new Analytics(mixpanel)
  }
});

// Testing
const testCreateUser = createUser.callable({
  context: {
    userService: mockUserService,
    emailService: mockEmailService,
    analytics: mockAnalytics
  }
});
```

## Pattern: Request Context

Pass request-specific data:

```ts
const getResource = zagora()
  .input(z.string())
  .handler(({ context }, resourceId) => {
    if (!context.auth.includes(resourceId)) {
      throw new Error('Forbidden');
    }
    return context.db.find(resourceId);
  });

// In request handler
app.get('/resource/:id', (ctx) => {
  const auth = ctx.req.headers.get('Authorization');
  if (!auth) {
    return ctx.json({ error: 'unauthorized' });
  }
  
  const proc = getResource.callable({
    context: { 
      auth: auth,
      db: myDB
    }
  });
  
  const result = proc(ctx.req.param('id'));
});
```

## Context Without Input

Context works without input:

```ts
const getCurrentUser = zagora()
  .context({ auth: authService })
  .handler(({ context }) => {
    return context.auth.getCurrentUser();
  })
  .callable();
```

Use context to manage dependencies and inject runtime values.
