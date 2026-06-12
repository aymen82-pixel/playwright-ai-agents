# Locators

> Source: testdino-hq/playwright-skill (MIT) — core/locators.md (édition TypeScript ; les doublons JavaScript ont été retirés, le projet étant TS).
> **When to use**: Every time you need to find an element on the page. Start here before reaching for CSS or XPath.

## Quick Reference — priority order

```typescript
page.getByRole('button', { name: 'Submit' })   // 1. Role (default)
page.getByLabel('Email address')               // 2. Label (form fields)
page.getByText('Welcome back')                 // 3. Text (non-interactive)
page.getByPlaceholder('Search...')             // 4. Placeholder
page.getByAltText('Company logo')              // 5. Alt text (images)
page.getByTitle('Close dialog')                // 6. Title attribute
page.getByTestId('checkout-summary')           // 7. Test ID (last semantic option)
page.locator('css=...')                        // 8. CSS/XPath (last resort)
```

## Patterns

### Role-Based Locators (Default Choice)

Role-based locators mirror how assistive technology sees your page. They survive refactors, class renames, and component library swaps.

```typescript
await page.getByRole('button', { name: 'Save changes' }).click();
await page.getByRole('link', { name: 'View profile' }).click();
await expect(page.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeVisible();
await page.getByRole('textbox', { name: 'Email' }).fill('user@example.com');
await page.getByRole('checkbox', { name: 'Remember me' }).check();
await page.getByRole('radio', { name: 'Monthly billing' }).click();
await page.getByRole('combobox', { name: 'Country' }).selectOption('US');

// Landmarks, tables, dialogs — scope inner queries
const nav = page.getByRole('navigation', { name: 'Main' });
await expect(nav.getByRole('link', { name: 'Settings' })).toBeVisible();
const table = page.getByRole('table', { name: 'Recent orders' });
await expect(table.getByRole('row')).toHaveCount(5);
const dialog = page.getByRole('dialog', { name: 'Confirm deletion' });
await dialog.getByRole('button', { name: 'Delete' }).click();

// Exact matching — prevents "Log" from matching "Log out"
await page.getByRole('button', { name: 'Log', exact: true }).click();

// Playwright 1.60+ : disambiguate by accessible description
await page.getByRole('button', { name: 'Delete', description: 'Permanently removes this project' }).click();
```

### Label-Based Locators

For form fields with `<label>`, wrapping label, or `aria-label`/`aria-labelledby`.

```typescript
await page.getByLabel('First name').fill('Jane');
await page.getByLabel('Password', { exact: true }).fill('s3cure!Pass');
await page.getByLabel('I agree to the terms').check();
```

### Text-Based Locators

For non-interactive content only — never for buttons/links/fields.

```typescript
await expect(page.getByText('Order confirmed')).toBeVisible();          // substring
await expect(page.getByText('Order #12345', { exact: true })).toBeVisible();
await expect(page.getByText(/Order #\d+/)).toBeVisible();               // regex for dynamic content
```

### Test ID Locators

Only when no semantic locator works (canvas widgets, grids, third-party components). Configure once: `use: { testIdAttribute: 'data-testid' }`.

```typescript
const chart = page.getByTestId('revenue-chart');
await chart.click({ position: { x: 150, y: 75 } });
```

### CSS/XPath — Last Resort

```typescript
await page.locator('table.report-grid td:has-text("Overdue")').first().click();
await page.locator('xpath=//td[contains(text(),"Overdue")]/ancestor::tr//button').click();
```

### Chaining and Filtering

```typescript
const productCard = page.getByRole('listitem').filter({ hasText: 'Running Shoes' });
await productCard.getByRole('button', { name: 'Add to cart' }).click();

const row = page.getByRole('row').filter({ has: page.getByRole('cell', { name: 'Premium Plan' }) });
await row.getByRole('button', { name: 'Upgrade' }).click();

const availableItems = page.getByRole('listitem').filter({ hasNot: page.getByText('Sold out') });

// Positional — use sparingly, only when order is stable
const thirdItem = page.getByRole('listitem').nth(2);

// Combining multiple filters
const activeAdminRow = page.getByRole('row')
  .filter({ has: page.getByRole('cell', { name: 'Admin' }) })
  .filter({ has: page.getByText('Active') });
```

### Frame Locators

```typescript
const paymentFrame = page.frameLocator('iframe[title="Payment"]');
await paymentFrame.getByLabel('Card number').fill('4242424242424242');
// Nested iframes — chain frameLocator calls
const nested = page.frameLocator('#outer-frame').frameLocator('#inner-frame');
```

### Shadow DOM

`getByRole`/`getByText`/`locator()` pierce open Shadow DOM automatically — just use them normally, including chained into custom elements.

### Dynamic Content — never `waitForTimeout`

```typescript
await expect(page.getByRole('listitem')).toHaveCount(10);          // auto-retry
await expect(page.getByRole('progressbar')).toBeHidden();          // wait for loading to end

const responsePromise = page.waitForResponse('**/api/search*');
await page.getByRole('button', { name: 'Load more' }).click();
await responsePromise;

await page.waitForURL('**/results/**');
```

## Decision Guide

| Element Type | Recommended Locator |
|---|---|
| Button | `getByRole('button', { name })` |
| Link | `getByRole('link', { name })` |
| Text input | `getByRole('textbox', { name })` |
| Password input | `getByLabel('Password')` (no distinct role) |
| Checkbox / Radio | `getByRole('checkbox'/'radio', { name })` + `.check()` |
| Select | `getByRole('combobox', { name })` |
| Custom dropdown | trigger puis `getByRole('option', { name })` |
| Heading | `getByRole('heading', { name, level })` |
| Table row | `getByRole('row').filter({ has: cell })` |
| Dialog/modal | `getByRole('dialog', { name })` puis scoper dedans |
| Tab | `getByRole('tab', { name })` — **jamais** `button` |
| Image | `getByAltText()` |
| Static text | `getByText()` |
| No semantic markup | `getByTestId()` |
| Iframe content | `frameLocator()` puis locator normal |

## Anti-Patterns

| Don't | Problem | Do |
|---|---|---|
| `locator('.btn-primary')` | breaks on CSS rename | `getByRole('button', { name: 'Save' })` |
| `locator('#submit-btn')` | IDs auto-générés/implémentation | `getByRole('button', { name: 'Submit' })` |
| `locator('div > span:nth-child(3)')` | breaks on DOM restructure | `getByText()` / `getByTestId()` |
| `getByText('Submit')` pour un bouton | n'affirme pas l'interactivité | `getByRole('button', ...)` |
| `.nth(0)` sur listes dynamiques | l'index bouge | `.filter({ hasText: ... })` |
| texte i18n en dur | casse au changement de locale | regex insensible (`/accept/i`) ou testId |
| `waitForTimeout(3000)` | arbitraire et flaky | `expect(locator).toBeVisible()` |
| `page.$('selector')` | snapshot non auto-waiting, déprécié | `page.locator()` |

## Troubleshooting

**"strict mode violation"** (plusieurs éléments matchés) : ajouter `name`, scoper dans un parent (`getByRole('dialog').getByRole('button', ...)`), `exact: true`, ou `.filter()`. Debug : `await page.getByRole('button').all()`.

**Element exists but times out** : vérifier iframe (`frameLocator`), Shadow DOM (passer à `getByRole`), ou élément caché (`toBeAttached()` si c'est attendu).

**`getByRole` ne trouve pas** : role ARIA implicite différent de l'attendu. Inspecter l'arbre d'accessibilité (`page.accessibility.snapshot()`). Cas courants : `<div onclick>` n'a pas de role button ; input sans label n'a pas de nom accessible ; `<a>` sans href n'a pas de role link. Chaîne de repli : getByLabel → getByText → getByTestId → locator().
