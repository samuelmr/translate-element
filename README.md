# translate-element

A simple web component for translating text content in HTML pages.

Author your HTML content in any language. Mark the translatable sections with the lang attribute. Create a JSON file for translations. Add the web component to your page, and it will render a language switcher element for the languages found.

1. Include the JavaScript file in your HTML:

```html
<script src="translate-element.js"></script>
```

2. Add the translate element to your page:

```html
<translate-element></translate-element>
```

3. Optionally, style the language switcher element using CSS:

```html
<link rel="stylesheet" href="translate-element.css">
```

4. EITHER, embed the translations into your page:

```html
<h1 lang="en">Welcome</h1>
<h1 lang="sv">Välkommen</h1>
<h1 lang="de">Willkommen</h1>
```

4. OR, create a file `translations.json` and publish it in the same folder with the page

```json
{
  "Text to translate": {
    "sv": "Text att översätta",
    "de": "Zu übersetzender Text"
  },
  "Welcome": {
    "sv": "Välkommen",
    "de": "Willkommen"
  }
}```


See [documentation](https://samuelmr.github.io/translate-element/) for further instructions.
