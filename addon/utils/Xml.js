export class Xml {
    static stringify({name, attributes, value}) {
      function buildRequest(el, params) {
        if (params == null) {
          el.setAttribute("xsi:nil", "true");
        } else if (typeof params == "object") {
          for (let [key, value] of Object.entries(params)) {
            if (key == "$xsi:type") {
              el.setAttribute("xsi:type", value);
            } else if (value === undefined) {
              // ignore
            } else if (Array.isArray(value)) {
              for (let element of value) {
                let x = doc.createElement(key);
                buildRequest(x, element);
                el.appendChild(x);
              }
            } else {
              let x = doc.createElement(key);
              buildRequest(x, value);
              el.appendChild(x);
            }
          }
        } else {
          el.textContent = params;
        }
      }
      let doc = new DOMParser().parseFromString("<" + name + attributes + "/>", "text/xml");
      buildRequest(doc.documentElement, value);
      return '<?xml version="1.0" encoding="UTF-8"?>' + new XMLSerializer().serializeToString(doc).replace(/ xmlns=""/g, "");
    }
  
    static parse(element) {
      function parseResponse(element) {
        let str = ""; // XSD Simple Type value
        let obj = null; // XSD Complex Type value
        // If the element has child elements, it is a complex type. Otherwise we assume it is a simple type.
        if (element.getAttribute("xsi:nil") == "true") {
          return null;
        }
        let type = element.getAttribute("xsi:type");
        if (type) {
          // Salesforce never sets the xsi:type attribute on simple types. It is only used on sObjects.
          obj = {
            "$xsi:type": type
          };
        }
        for (let child = element.firstChild; child != null; child = child.nextSibling) {
          if (child instanceof CharacterData) {
            str += child.data;
          } else if (child instanceof Element) {
            if (obj == null) {
              obj = {};
            }
            let name = child.localName;
            let content = parseResponse(child);
            if (name in obj) {
              if (obj[name] instanceof Array) {
                obj[name].push(content);
              } else {
                obj[name] = [obj[name], content];
              }
            } else {
              obj[name] = content;
            }
          } else {
            throw new Error("Unknown child node type");
          }
        }
        return obj || str;
      }
      return parseResponse(element);
    }
  }