const CLARITY_ID = "xwljbdr45b";

(function (c: any, l: Document, a: string, r: string, i: string, t?: HTMLScriptElement, y?: HTMLElement) {
  c[a] =
    c[a] ||
    function (...args: any[]) {
      (c[a].q = c[a].q || []).push(args);
    };

  t = l.createElement(r) as HTMLScriptElement;
  t.async = true;
  t.src = "https://www.clarity.ms/tag/" + i;

  y = l.getElementsByTagName(r)[0];

  y.parentNode?.insertBefore(t, y);
})(window, document, "clarity", "script", CLARITY_ID);

export {};