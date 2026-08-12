{{#clause id=REFUND.SCOPE}}
## What this page covers

This page tells you how to cancel, what happens to your money when you do, and how long each step takes.

It applies to what you pay **{{ facts.operator.legal_name }}** for the service at {{ facts.site_url }}. It does not cover anything you buy from anyone else.
{{/clause}}

{{#clause id=REFUND.WINDOW when=payment_model=gateway}}
## Refunds

You can ask for a refund within **{{ facts.refund_window_days }} days** of a payment.

Inside that window we refund in full, and we do not ask you to justify it. Outside it, write to us anyway — we will look at what happened, and we will tell you plainly whether we are refunding and why.

Refunds go back to the method you paid with. We cannot send a card payment to a bank account instead; that is the payment provider's rule, not a preference of ours.
{{/clause}}

{{#clause id=REFUND.MOR when=payment_model=mor}}
## Refunds

You can ask for a refund within **{{ facts.refund_window_days }} days** of a payment.

Your payment was taken by {{ label.payment_provider }} as the merchant of record, so the refund is issued by them, on our instruction. You do not have to contact them yourself — write to us and we will start it.

Refunds go back to the method you paid with.
{{/clause}}

{{#clause id=REFUND.OFFLINE when=payment_model=none}}
## Refunds

You can ask for a refund within **{{ facts.refund_window_days }} days** of a payment.

**There is no payment gateway in this arrangement.** You paid us directly, by bank transfer or by another method we agreed in writing, so a refund is made the same way: back to the account the money came from.

That means there is no card reversal to wait on, and no processing window imposed by a provider. It also means we need your bank details to send it, and we will ask you for them over the same channel we invoiced you on — never over a link in an email.
{{/clause}}

{{#clause id=REFUND.PROCESSING when=payment_model=gateway}}
## How long a refund takes

**We tell you yes or no within {{ facts.commitments.refund_decision_days }} working day(s) of your asking**, and inside the window above the answer is yes. We start the refund within 2 working days of that.

After that, how long it takes to appear is the bank's part, not ours: with {{ label.payment_provider }} it is usually 5 to 7 working days, and it can be longer for some cards. If it has not arrived after 10 working days, write to us and we will chase it with the provider and tell you what they say.
{{/clause}}

{{#clause id=REFUND.PROCESSING.MOR when=payment_model=mor}}
## How long a refund takes

**We tell you yes or no within {{ facts.commitments.refund_decision_days }} working day(s) of your asking**, and inside the window above the answer is yes.

We instruct {{ label.payment_provider }} within 2 working days of that. If the money has not reached you within 10 working days of our instruction, write to us: we will chase them, tell you what they say, and if it is still not with you we will pay you directly rather than leave you waiting on someone you never contracted with.
{{/clause}}

{{#clause id=REFUND.PROCESSING.OFFLINE when=payment_model=none}}
## How long a refund takes

**We tell you yes or no within {{ facts.commitments.refund_decision_days }} working day(s) of your asking**, and inside the window above the answer is yes.

We send the transfer within 2 working days of that. There is no provider in the middle, so there is nobody for us to blame if it is late — it usually lands the same or the next working day.
{{/clause}}

{{#clause id=REFUND.BILLING_ERROR}}
## If we charged you wrongly

**A billing error is not a refund request, and the window above does not apply to it.**

If we charge you twice for the same thing, charge you after you cancelled or turned renewal off, or charge you an amount you never agreed to, that is our mistake. Tell us whenever you notice it, however long afterwards, and we refund it in full.

You do not have to argue the window with us. Write to {{ facts.support.email }}.
{{/clause}}

{{#clause id=REFUND.HOW_TO_REQUEST}}
## How to ask for a refund

Write to **{{ facts.support.email }}** with the account and the payment you mean.

That is the whole process. There is no form, no ticket number to obtain first, and nobody you have to speak to on the phone before we will consider it.

We reply within {{ window.ack_hours }} hours.
{{/clause}}

{{#clause id=CANCEL.PATH}}
## How to cancel

You can cancel from inside your account, in the billing section.

**Cancelling takes no more steps than signing up did.** If you ever find that it does, that is a fault on our side and we want to hear about it at {{ facts.support.email }}.

You can also cancel by writing to {{ facts.support.email }}. We will action it and confirm.
{{/clause}}

{{#clause id=CANCEL.AUTORENEW when=derived.autorenew=yes}}
## Automatic renewal

If your plan renews automatically, we email you the **amount** and the **date** **at least {{ facts.commitments.renewal_notice_days }} day(s) before we take the payment**. Not on the day, and not after.

If we fail to send that notice and you did not want the renewal, we refund it in full — the window above does not apply.

You can turn renewal off at any time from the billing section. Turning it off does not end your current period — you keep what you have paid for until it runs out.
{{/clause}}

{{#clause id=CANCEL.NO_MAZE}}
## What we will not do when you cancel

We will not put a retention offer between you and the cancel button.

We will not require a phone call, a chat session, or a reason. **We ask you nothing on the way out** — not once, not in different words. We will not hide the final step behind a page that looks like it already finished.

Cancelling is done in the billing section of your account. Nothing else stands in your way, and if you would rather not use the account at all, an email to {{ facts.support.email }} does the same thing.
{{/clause}}

{{#clause id=CANCEL.EFFECT}}
## What happens after you cancel

Your access continues until the end of the period you have paid for. We do not cut it off the moment you cancel, and we do not refund the unused part of a period you chose to leave early.

**A refund is the other choice, not an extra one.** If we refund a payment in full, the access it bought ends when we make the refund. You cannot keep both, and we would rather say so here than surprise you later.

Before it ends, export what you want to keep. After it ends, what we hold and for how long is set out in the [Privacy Policy]({{ facts.routes.privacy }}), and you can ask us to delete it at {{ facts.deletion_route.mailbox }}.

Cancelling is not the same as deleting. If you want both, say so, and we will do both.
{{/clause}}

{{#clause id=REFUND.GST_INVOICE when=derived.invoice_kind=gst}}
## Invoices and tax

We are registered for GST. Our GSTIN is **{{ facts.gstin }}**, and it appears on every invoice we issue.

Ask at {{ facts.support.email }} for an invoice for any payment and we will send it. If you need your own GSTIN on it, tell us and we will re-issue.

What the tax treatment of your purchase means for your own filings is a question for your accountant, not for this page.
{{/clause}}

{{#clause id=REFUND.NO_GST when=derived.invoice_kind=no-gst}}
## Invoices and tax

**We are not registered for GST**, so our invoices carry no GSTIN and no GST is charged on them.

Ask at {{ facts.support.email }} for an invoice for any payment and we will send it.

What that means for your own filings is a question for your accountant, not for this page.
{{/clause}}

{{#clause id=REFUND.MOR_INVOICE when=derived.invoice_kind=provider}}
## Invoices and tax

**Your receipt comes from {{ label.payment_provider }}, not from us.** They sell you the subscription as the merchant of record, so they issue the tax document and they handle any tax on your purchase. Our own GST registration does not appear on it, because we are not the seller of that transaction.

If you need a copy of that receipt, ask us at {{ facts.support.email }} and we will get it for you rather than sending you to them.

What the tax treatment means for your own filings is a question for your accountant, not for this page.
{{/clause}}

{{#clause id=REFUND.DISPUTE.GATEWAY when=payment_model=gateway}}
## If you dispute a payment

Write to {{ facts.support.email }} first. Almost every dispute is a mistake we can fix in a day, and a chargeback takes weeks.

If you do raise a chargeback with your bank, we will not suspend your account for raising it. We will send the bank what they ask for, and we will send you the same material at the same time so you can see what we said.
{{/clause}}

{{#clause id=REFUND.DISPUTE.MOR when=payment_model=mor}}
## If you dispute a payment

Write to {{ facts.support.email }} first. We can usually resolve it faster than a formal dispute can.

Because {{ label.payment_provider }} is the merchant of record, a formal dispute is handled by them under their own process. We will give them what they ask for, and we will tell you what we sent.
{{/clause}}

{{#clause id=REFUND.DISPUTE.OFFLINE when=payment_model=none}}
## If you dispute a payment

Write to {{ facts.support.email }}.

Because you paid us directly rather than through a payment gateway, there is no chargeback route and no third party to arbitrate: it is between you and us. That puts more weight on us answering properly, which is why the grievance route in the [Privacy Policy]({{ facts.routes.privacy }}) has a named person and a stated response time, and applies to a billing complaint just as much as to a data one.
{{/clause}}

{{#clause id=REFUND.CONTACT}}
## Who to write to

Refunds, cancellation and invoices: **{{ facts.support.email }}**, or call {{ facts.support.phone }}.

If you are not satisfied with the answer, the grievance route is in the [Privacy Policy]({{ facts.routes.privacy }}) and it covers billing complaints too.
{{/clause}}
