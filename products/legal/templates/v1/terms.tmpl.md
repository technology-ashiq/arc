{{#clause id=TERMS.PARTIES}}
## Who you are agreeing with

This service is operated by **{{ facts.operator.legal_name }}**, {{ label.operator.type }}, trading as **{{ facts.operator.trade_name }}**, at {{ facts.geographic_address }}.

Where these terms say "we" or "us", they mean {{ facts.operator.legal_name }}. Where they say "you", they mean the person or organisation using the service.
{{/clause}}

{{#clause id=TERMS.SERVICE}}
## What the service is

The service is the software made available at {{ facts.site_url }}, together with any part of it you reach after signing in.

We may change how the service works. If a change removes something you were relying on, we will say so on this page and give you the choice to stop paying before the change takes effect.
{{/clause}}

{{#clause id=TERMS.ELIGIBILITY}}
## Who may use it

You may use the service if you can enter into a contract under Indian law and you are using it for your own work or for the organisation you are authorised to act for.

If you are using it on behalf of an organisation, you are telling us that you have the authority to accept these terms for that organisation.
{{/clause}}

{{#clause id=TERMS.ACCOUNT}}
## Your account

You are responsible for what happens under your account, including anything done by people you give access to.

Keep your sign-in details to yourself. If you think someone else has them, write to {{ facts.support.email }} and we will help you lock the account.

We do not ask for your password, and nobody who works for us has a reason to. Treat any message asking for it as a message that is not from us.
{{/clause}}

{{#clause id=TERMS.ACCEPTABLE_USE}}
## What you may not do

Do not use the service to break the law, to store or send material you have no right to, to attack or overload the service, or to work around the limits of the plan you are paying for.

Do not resell access to people outside your organisation unless we have agreed to it in writing.

If what you are doing puts other people using the service at risk, we may suspend your account first and explain afterwards. We will tell you what happened and what you can do about it.
{{/clause}}

{{#clause id=TERMS.PROCESSOR_ROLE when=stores_third_party_client_data=true}}
## Records about other people

The service is built to hold records about people you serve. Those records are yours, not ours.

We act on your instructions in respect of them. We do not decide what to collect, we do not use them to build anything of our own, and we do not train any model on them. What we do with them, and who else can touch them, is set out in the [Privacy Policy]({{ facts.routes.privacy }}).

You are responsible for having a lawful basis to hold those records and for telling the people concerned what you hold. We cannot do that for you, because we do not know them and you do.
{{/clause}}

{{#clause id=TERMS.FEES.GATEWAY when=payment_model=gateway}}
## Fees and payment

You pay the fee shown on the pricing page for the plan you choose. Fees are in Indian Rupees.

We are the merchant for these payments. Card and bank payments are processed for us by {{ label.payment_provider }}; we do not store your full card number.

Payment is due before the period it covers. If a payment fails, we will tell you and give you a chance to fix it before access is affected.

How refunds and cancellation work is set out on the [Cancellation and Refunds page]({{ facts.routes.refund-cancellation }}).
{{/clause}}

{{#clause id=TERMS.FEES.MOR when=payment_model=mor}}
## Fees and payment

You pay the fee shown on the pricing page for the plan you choose.

Your payment is taken by {{ label.payment_provider }}, which sells the subscription to you as the merchant of record and issues your receipt. Your contract for the payment itself is with them; your contract for the service is with us.

Any tax on your purchase is handled by the merchant of record and appears on the receipt they issue.

How refunds and cancellation work is set out on the [Cancellation and Refunds page]({{ facts.routes.refund-cancellation }}).
{{/clause}}

{{#clause id=TERMS.FEES.OFFLINE when=payment_model=none}}
## Fees and payment

You pay the fee shown on the pricing page for the plan you choose. Fees are in Indian Rupees.

**We do not take payments through a payment gateway on this site.** We invoice you directly and you pay by bank transfer or by another method we agree with you in writing. There is no card payment page here, and this site will never ask you for card details.

Because there is no gateway in the middle, there is no card refund route: any refund is made by the same bank route the payment came in on. That is set out on the [Cancellation and Refunds page]({{ facts.routes.refund-cancellation }}).
{{/clause}}

{{#clause id=TERMS.IP}}
## Who owns what

We own the service, the software behind it, and the way it looks. You may use it, but using it does not transfer any of that to you.

You own what you put into it. You are giving us permission to store it, back it up and show it back to you and to the people you have given access to. That permission exists so we can run the service, and it ends when you delete the material or close your account.
{{/clause}}

{{#clause id=TERMS.TERMINATION}}
## Ending the arrangement

You may stop using the service at any time. How to cancel, and what happens to your money, is on the [Cancellation and Refunds page]({{ facts.routes.refund-cancellation }}).

We may end your access if you seriously break these terms, or if we stop offering the service. Except where you have broken these terms in a way that puts others at risk, we will give you notice and a way to take your material with you before access ends.

When the arrangement ends, you can export what you put in. After that, what we keep and for how long is set out in the [Privacy Policy]({{ facts.routes.privacy }}).
{{/clause}}

{{#clause id=TERMS.LIABILITY}}
## What we are responsible for

We take care to run the service properly. We do not promise it will be available without interruption, and we do not promise it will be free of faults.

We are responsible to you for loss we cause by failing to take reasonable care. We are not responsible for loss of profit, loss of business, or loss you could have avoided by keeping your own copy of your material.

Where the law says a liability cannot be excluded, nothing here excludes it.

Our total liability to you in any twelve-month period is limited to what you paid us in that period.
{{/clause}}

{{#clause id=TERMS.GOVERNING_LAW}}
## Which law applies

These terms are governed by the law of India, and the courts at the place of our registered address have jurisdiction over any dispute about them.

Before going to court, write to us at {{ facts.support.email }}. Most things are faster to fix that way, and we would rather fix them.
{{/clause}}

{{#clause id=TERMS.CHANGES}}
## Changes to these terms

We may change these terms. When we do, the version on this page changes and the effective date at the top changes with it.

We keep the earlier versions. If you want to see what a term said on a particular date, ask us at {{ facts.support.email }} and we will send you that version.

If a change materially reduces what you get, we will tell you before it takes effect and you may cancel.
{{/clause}}

{{#clause id=TERMS.NOT_LEGAL_ADVICE}}
## One thing this page is not

Nothing here is legal advice. This page sets out the arrangement between you and us. It does not tell you what the law requires of you in your own work, and it is not a substitute for asking someone qualified about your own situation.
{{/clause}}

{{#clause id=TERMS.CONTACT}}
## How to reach us

Write to {{ facts.support.email }} or call {{ facts.support.phone }}.

Post reaches us at {{ facts.geographic_address }}.

For a complaint rather than a question, use the grievance route set out in the [Privacy Policy]({{ facts.routes.privacy }}); it has a named person and a stated response time.
{{/clause}}
