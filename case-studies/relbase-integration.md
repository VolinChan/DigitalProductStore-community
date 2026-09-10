# Beyond the happy path: my investigation of an inventory-to-invoice integration

[中文](relbase-integration.zh-CN.md) · [Español (Chile)](relbase-integration.es-CL.md) · [Project overview](../README.md)

**Plexoria development notes · 10 September 2026**

When integrating RelBase into Plexoria, I needed to connect a specific sequence: create a sales note to commit inventory when a customer orders, then issue a Boleta or Factura from that note after payment. Inventory had already been committed. Issuing the tax document must not deduct it again, and shipping charges and payment totals had to remain consistent.

Creating the sales note worked. Converting it exposed a problem. Investigating that path also led me to revisit how shipping enters the document, where the gross amount mode is set, and whether a failed request can safely be retried. These notes describe that work on the private Pro implementation.

## Making the conversion issue reproducible

The behavior was difficult to reconcile: a request referring to the source note without product lines was asked to supply products; adding the products produced a validation saying that this conversion could not include them.

I collected the differences between those requests, the source note's state and correlation identifiers for the support team. A controlled attempt following their suggested procedure still encountered the detail validation, so I asked for a technical review of the conversion path actually being executed.

I did not bypass the source note by issuing a standalone document with products. The source note had already committed inventory. Even a successful standalone invoice could leave a second stock deduction and an unlinked sales note.

The subsequent technical discussion clarified the behavior that needed adjustment and the source note's amount requirements. That gave us a more specific integration contract and a concrete basis for the next validation.

## Shipping was a local omission, but a separate question

During the investigation, a colleague compared an order with its sales note and noticed that shipping appeared in the order but not in the note. That was a gap in our own flow.

If the tax document inherits its lines, charged shipping has to be present when the source note is created. I made shipping part of the document's charges, mapped by the RelBase adapter to a non-stock service item. Free shipping adds no line. Merchandise and shipping contribute to the total, while inventory checks and deductions remain limited to merchandise.

Finding that omission did not establish the cause of the contradictory detail validation. I kept the conversion reproduction separate and progressed the local amount fix alongside the provider investigation. I also could not assume that correcting the code would update previously created notes.

## Rechecking the right to retry

A generally advertised idempotency header was not enough to establish replay protection for the document resource. After checking the guarantee with support, I moved duplicate-dispatch protection into durable local records.

Before a creation request leaves the application, it claims a dispatch for the provider connection and stable business command. Another worker, a restarted service or a repeated action cannot silently send the same command again. Document writes also do not inherit generic automatic replay on authentication failure or redirects.

There is a cost: a process that stops after claiming the dispatch but before sending the request can leave work requiring investigation. This does not solve end-to-end “exactly once” execution. I accepted that tradeoff because pausing an uncertain stock or fiscal operation is more controllable than issuing it a second time.

## Setting the amount mode on the source

The clarified conversion rule requires a Boleta's source note to contain gross, IVA-inclusive amounts. Conversion then inherits the source amount mode.

Plexoria already created sales notes with gross prices. The adjustment here was to stop specifying the amount mode again during conversion, while retaining checks across source lines, fees and the total. A conversion parameter cannot repair an old note with missing shipping or an unsuitable amount mode.

I kept these provider-specific details in the adapter. Checkout and order logic still work with generic merchandise, shipping charges and business commands; a wire-contract change should not require rewriting the purchase flow.

## How I checked the changes

The local conversion simulation covers 12 combinations: Boleta/Factura, free/two charged-shipping amounts, and one/three merchandise units. The simulated provider calculates its result from the lines actually received when creating the source note. It does not simply return the expected invoice total supplied by the test.

Backend race checks against PostgreSQL 14 and Redis 7, and the release regression suite, passed. Those tests belong to the private Pro implementation; their backend code is not included in Community. Shipping completeness, dispatch protection and the amount-mode adjustment have been deployed.

As of this note's date, however, the updated external conversion has not completed live end-to-end acceptance. I have kept controlled conversion retries on hold pending release confirmation and review of the selected source note.

The next check goes beyond a successful response: the issued document must link to its source, amounts and payment handling must agree, the source state must update, and merchandise inventory must not decrease again. A zero-quantity stock-history entry described by the provider also needs to be distinguished from an actual deduction.

This investigation made my acceptance criteria more concrete: not just whether a request succeeds, but whether the same transaction remains consistent across the systems involved. I will add the live validation results here as that work progresses.
