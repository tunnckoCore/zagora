---
description: "Pass shared dependencies to handlers. Context allows you to inject dependencies like databases, loggers, or configuration into your handlers."
head:
  - - meta
    - property: og:description
      content: "Pass shared dependencies to handlers. Context allows you to inject dependencies like databases, loggers, or configuration into your handlers."
---

# Context Management

Context allows you to inject dependencies like databases, loggers, or configuration into your handlers.

## Setting Initial Context

Use `.context()` to define initial context:

```ts
import { z } from 'zod';
import { zagora } from 'zagora';

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
  .callable();

// Use production db (from initial context)
getUser('123');

// Override with test db
const testGetUser = getUser.callable({ 
  context: { db: testDb } 
});
testGetUser('123');
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
    context: { extra: 'value' } 
  });

// Handler sees merged context:
// { db: myDb, config: { timeout: 5000 }, extra: 'value' }
```

## TypeScript Inference

Context is fully typed:

```ts
const proc = zagora()
  .context({ db: myDatabase })
  .handler(({ context }) => {
    context.db;      // typeof myDatabase
    context.other;   // TypeScript error!
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

## Pattern: Dependency Injection

Use context for clean dependency injection:

```ts
// Define procedure with dependencies
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
    // Check permissions using request context
    if (!context.user.canAccess(resourceId)) {
      throw new Error('Forbidden');
    }
    return context.db.find(resourceId);
  });

// In request handler
app.get('/resource/:id', (req, res) => {
  const proc = getResource.callable({
    context: { 
      user: req.user,
      db: req.db
    }
  });
  
  const result = proc(req.params.id);
  // ...
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

## Next Steps

- [Handler Options](/docs/handler-options) - Full options object reference
- [Environment Variables](/docs/env-vars) - Type-safe env var access
