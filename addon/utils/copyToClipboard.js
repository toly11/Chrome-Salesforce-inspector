// Copy text to the clipboard, without rendering it, since rendering is slow.
export function copyToClipboard(value) {
    if (parent && parent.isUnitTest) { // for unit tests
      parent.testClipboardValue = value;
      return;
    }
    // Use execCommand to trigger an oncopy event and use an event handler to copy the text to the clipboard.
    // The oncopy event only works on editable elements, e.g. an input field.
    let temp = document.createElement("input");
    // The oncopy event only works if there is something selected in the editable element.
    temp.value = "temp";
    temp.addEventListener("copy", e => {
      e.clipboardData.setData("text/plain", value);
      e.preventDefault();
    });
    document.body.appendChild(temp);
    try {
      // The oncopy event only works if there is something selected in the editable element.
      temp.select();
      // Trigger the oncopy event
      let success = document.execCommand("copy");
      if (!success) {
        alert("Copy failed");
      }
    } finally {
      document.body.removeChild(temp);
    }
  }