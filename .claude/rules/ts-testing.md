---
paths: 
    - "**/*.{test,spec}.{ts,tsx,js,jsx}"
---

# TypeScript Testing Standards

## Test structure

### describe/it
Organizar tests con `describe` para la unidad bajo test e `it` para cada comportamiento:

```typescript
describe('UserService', () => {
    describe('createUser', () => {
        it('should create user with valid data', () => { /* ... */ });
        it('should throw on duplicate email', () => { /* ... */ });
    });
});
```

### Patron AAA (Arrange-Act-Assert)
Cada test sigue tres bloques separados por lineas en blanco:

```typescript
it('should calculate total with discount', () => {
    // Arrange
    const cart = new Cart();
    cart.addItem({ price: 100, quantity: 2 });

    // Act
    const total = cart.calculateTotal(0.1);

    // Assert
    expect(total).toBe(180);
});
```

No usar comentarios `// Arrange`, `// Act`, `// Assert` -- las lineas en blanco son suficientes.

## Co-locacion de tests

Colocar archivos de test junto al codigo que testean:
```
src/
  services/
    user.ts
    user.test.ts
  utils/
    format.ts
    format.test.ts
```

Si el proyecto usa directorio `__tests__/`, respetar esa convencion.

## Setup compartido

Usar `beforeEach` para setup que se repite en multiples tests. Evitar `beforeAll` con estado mutable que pueda causar tests interdependientes.

```typescript
describe('OrderProcessor', () => {
    let processor: OrderProcessor;

    beforeEach(() => {
        processor = new OrderProcessor();
    });
});
```

## Assertions

Usar las assertions nativas del framework:
- Vitest/Jest: `expect(value).toBe()`, `.toEqual()`, `.toThrow()`, `.toHaveBeenCalled()`
- Testing Library: `screen.getByRole()`, `screen.queryByText()`

Evitar `toBeTruthy()`/`toBeFalsy()` para valores no booleanos -- usar assertions mas especificas.

## Async testing

```typescript
it('should fetch user data', async () => {
    const user = await service.getUser('123');

    expect(user.name).toBe('Diego');
});
```

Siempre usar `async/await` en lugar de callbacks o `.then()` en tests.

## Mocking

Preferir mocks minimizados. Usar `msw` para mock de APIs HTTP a nivel de red en lugar de mockear `fetch` directamente. Para dependencias internas, usar inyeccion de dependencias sobre `vi.mock()`/`jest.mock()`.

## Cobertura

```bash
npx vitest run --coverage
# o
npx jest --coverage
```

Configurar umbrales en `vitest.config.ts` o `jest.config.ts`. Objetivo: 80%+ de lineas.
