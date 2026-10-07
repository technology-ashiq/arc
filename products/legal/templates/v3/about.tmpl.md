{{#clause id=ABOUT.WHO}}
## Who we are

**{{ facts.operator.legal_name }}** is {{ label.operator.type }}, trading as **{{ facts.operator.trade_name }}**.

We operate from {{ facts.geographic_address }}.

Where you see the name **{{ facts.operator.trade_name }}** on this site, the entity behind it is {{ facts.operator.legal_name }}. Those two names are printed together here so that nobody has to guess who they are actually dealing with.
{{/clause}}

{{#clause id=ABOUT.WHAT}}
## What we do

We build and run the software service at {{ facts.site_url }}.

That is the whole of our business relationship with you. We are not a marketplace, we are not an intermediary between you and someone else, and we do not resell anyone else's product to you under our own name.
{{/clause}}

{{#clause id=ABOUT.PROCESSOR_ROLE when=stores_third_party_client_data=true}}
## About the records you keep here

This service holds records about the people you serve. Those records are yours, and we act only on your instructions in respect of them.

We do not use them for any purpose of our own, and we do not train any model on them. The full statement is in the [Privacy Policy]({{ facts.routes.privacy }}).
{{/clause}}

{{#clause id=ABOUT.HOW_TO_REACH}}
## Reaching us

Everything you need is on the [Contact page]({{ facts.routes.contact }}): support, the postal address, and a named grievance officer with a stated response time.

For what we do with your data, see the [Privacy Policy]({{ facts.routes.privacy }}). For what you are agreeing to, see the [Terms and Conditions]({{ facts.routes.terms }}).
{{/clause}}

{{#clause id=ABOUT.NO_CLAIMS}}
## What this page does not say

We have not put awards, badges or partner logos on this page.

If we ever claim something here, it will be something we can show you evidence for. A page like this is the easiest place in a company to write a sentence nobody checks, and we would rather it stayed short.
{{/clause}}
