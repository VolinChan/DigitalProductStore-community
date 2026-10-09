# Storefront control styles

The customer storefront uses the navy, warm-white and light-blue palette in
`src/app/globals.css`. `StorefrontThemeProvider` applies the same palette to
Ant Design controls and their portalled menus, drawers and dialogs. Keep it in
`MainLayout`; admin pages retain their own theme.

| Purpose | Native button or action link | Example |
| --- | --- | --- |
| Main next step | `sf-button-primary` | Submit order, pay, sign in |
| Supporting action | `sf-button-secondary` | Add to cart, retry, pagination |
| Low emphasis action | `sf-button-quiet` | Continue shopping, clear saved address |
| Destructive action | `sf-button-danger` | Clear cart, cancel order, sign out |
| Icon action | `sf-icon-button` | Menu, retry upload |
| Destructive icon | `sf-icon-button sf-icon-button-danger` | Remove upload |

Use native `disabled` on unavailable buttons. Controls must have a visible
keyboard focus indicator; icon-only buttons also need a translated `aria-label`.
Main actions are at least 48px high; compact Ant Design actions and icon buttons
are at least 44px. Let labels wrap on narrow screens instead of clipping them.

Use Ant Design's `type="primary"`, default and `danger` variants inside the
storefront provider. Do not patch individual dialog colors or move portal
containers to work around theming. Use menu item callbacks for menu actions.

Category choices, image thumbnails, quantity steppers and navigation links have
their own selection/navigation treatment; do not turn them into primary CTAs.
Keep their hover, selected, disabled and keyboard focus states intentional.

Tailwind preflight remains disabled. The low-specificity reset under
`:where(.storefront)` removes native button chrome without changing admin styles
or overriding utility classes. Do not enable a global reset as a shortcut.

Regression coverage lives in `tests/e2e/storefront-controls.spec.ts`. Inspect
desktop and 320px layouts, including dialogs rendered outside the page wrapper.
