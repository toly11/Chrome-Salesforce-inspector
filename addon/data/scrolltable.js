/*
A table that contains millions of records will freeze the browser if we try to render the entire table at once.
Therefore we implement a table within a scrollable area, where the cells are only rendered, when they are scrolled into view.

Limitations:
* It is not possible to select or search the contents of the table outside the rendered area. The user will need to copy to Excel or CSV to do that.
* Since we initially estimate the size of each cell and then update as we render them, the table will sometimes "jump" as the user scrolls.
* There is no line wrapping within the cells. A cell with a lot of text will be very wide.

Implementation:
Since we don't know the height of each row before we render it, we assume to begin with that it is fairly small, and we then grow it to fit the rendered content, as the user scrolls.
We never schrink the height of a row, to ensure that it stabilzes as the user scrolls. The heights are stored in the `rowHeights` array.
To avoid re-rendering the visible part on every scroll, we render an area that is slightly larger than the viewport, and we then only re-render, when the viewport moves outside the rendered area.
Since we don't know the height of each row before we render it, we don't know exactly how many rows to render.
However since we never schrink the height of a row, we never render too few rows, and since we update the height estimates after each render, we won't repeatedly render too many rows.
The initial estimate of the height of each row should be large enough to ensure we don't render too many rows in our initial render.
We only measure the current size at the end of each render, to minimize the number of synchronous layouts the browser needs to make.
We support adding new rows to the end of the table, and new cells to the end of a row, but not deleting existing rows, and we do not reduce the height of a row if the existing content changes.
Each row may be visible or hidden.
In addition to keeping track of the height of each cell, we keep track of the total height in order to adjust the height of the scrollable area, and we keep track of the position of the scrolled area.
After a scroll we search for the position of the new rendered area using the position of the old scrolled area, which should be the least amount of work when the user scrolls in one direction.
The table must have at least one row, since the code keeps track of the first rendered row.
We assume that the height of the cells we measure sum up to the height of the table.
We do the exact same logic for columns, as we do for rows.
We assume that the size of a cell is not influenced by the size of other cells. Therefore we style cells with `white-space: pre`.

@param element A DOM element to render the table within.
@param dataObs An observable that changes whenever data in the table changes.
@param resizeObs An observable that changes whenever the size of viewport changes.

initScrollTable(DOMElement element, Observable<Table> dataObs, Observable<void> resizeObs);
interface Table {
  Cell[][] table; // a two-dimensional array of table rows and cells
  boolean[] rowVisibilities; // For each row, true if it is visible, or false if it is hidden
  boolean[] colVisibilities; // For each column, true if it is visible, or false if it is hidden
  void renderCell(Cell cell, DOMElement element); // Render cell within element
}
interface Cell {
  // Anything, passed to the renderCell function
}
*/
function initScrollTable(element, dataObs, resizeObs) {
  "use strict";
  var scroller = document.createElement("div");
  scroller.className = "scrolltable-scroller";
  element.appendChild(scroller);
  var scrolled = document.createElement("div");
  scrolled.className = "scrolltable-scrolled";
  scroller.appendChild(scrolled);

  var initialRowHeight = 15; // constant: The initial estimated height of a row before it is rendered
  var initialColWidth = 50; // constant: The initial estimated width of a column before it is rendered
  var bufferHeight = 500; // constant: The number of pixels to render above and below the current viewport
  var bufferWidth = 500; // constant: The number of pixels to render to the left and right of the current viewport
  var headerRows = 1; // constant: The number of header rows
  var headerCols = 0; // constant: The number of header columns

  var rowHeights = []; // The height in pixels of each row
  var rowVisible = []; // The visibility of each row. 0 = hidden, 1 = visible
  var rowCount = 0;
  var totalHeight = 0; // The sum of heights of visible cells
  var firstRowIdx = 0; // The index of the first rendered row
  var firstRowTop = 0; // The distance from the top of the table to the top of the first rendered row
  var lastRowIdx = 0; // The index of the row below the last rendered row
  var lastRowTop = 0; // The distance from the top of the table to the bottom of the last rendered row (the top of the row below the last rendered row)
  var colWidths = []; // The width in pixels of each column
  var colVisible = []; // The visibility of each column. 0 = hidden, 1 = visible
  var colCount =  0;
  var totalWidth = 0; // The sum of widths of visible cells
  var firstColIdx = 0; // The index of the first rendered column
  var firstColLeft = 0; // The distance from the left of the table to the left of the first rendered column
  var lastColIdx = 0; // The index of the column to the right of the last rendered column
  var lastColLeft = 0; // The distance from the left of the table to the right of the last rendered column (the left of the column after the last rendered column)

  function dataChange() {
    var data = dataObs();
    if (data == null || data.rowVisibilities.length == 0 || data.colVisibilities.length == 0) {
      // First render, or table was cleared
      rowHeights = [];
      rowVisible = [];
      rowCount = 0;
      totalHeight = 0;
      firstRowIdx = 0;
      firstRowTop = 0;
      lastRowIdx = 0;
      lastRowTop = 0;

      colWidths = [];
      colVisible = [];
      colCount =  0;
      totalWidth = 0;
      firstColIdx = 0;
      firstColLeft = 0;
      lastColIdx = 0;
      lastColLeft = 0;
      render(data, {force: true});
    } else {
      // Data or visibility was changed
      var newRowCount = data.rowVisibilities.length;
      for (var r = rowCount; r < newRowCount; r++) {
        rowHeights[r] = initialRowHeight;
        rowVisible[r] = 0;
      }
      rowCount = newRowCount;
      for (var r = 0; r < rowCount; r++) {
        var newVisible = Number(data.rowVisibilities[r]);
        var visibilityChange = newVisible - rowVisible[r];
        totalHeight += visibilityChange * rowHeights[r];
        if (r < firstRowIdx) {
          firstRowTop += visibilityChange * rowHeights[r];
        }
        rowVisible[r] = newVisible;
      }
      var newColCount = data.colVisibilities.length;
      for (var c = colCount; c < newColCount; c++) {
        colWidths[c] = initialColWidth;
        colVisible[c] = 0;
      }
      colCount = newColCount;
      for (var c = 0; c < colCount; c++) {
        var newVisible = Number(data.colVisibilities[c]);
        var visibilityChange = newVisible - colVisible[c];
        totalWidth += visibilityChange * colWidths[c];
        if (c < firstColIdx) {
          firstColTop += visibilityChange * colWidths[c];
        }
        colVisible[c] = newVisible;
      }
      render(data, {force: true});
    }
  }

  function viewportChange() {
    render(dataObs(), {});
  }

  function render(data, options) {
    if (rowCount == 0 || colCount == 0) {
      scrolled.textContent = ""; // Delete previously rendered content
      scrolled.style.height = "0px";
      scrolled.style.width = "0px";
      return;
    }

    var scrollTop = scroller.scrollTop;
    var scrollLeft = scroller.scrollLeft;
    var offsetHeight = scroller.offsetHeight;
    var offsetWidth = scroller.offsetWidth;

    if (!options.force && firstRowTop <= scrollTop && (lastRowTop >= scrollTop + offsetHeight || lastRowIdx == rowCount) && firstColLeft <= scrollLeft && (lastColLeft >= scrollLeft + offsetWidth || lastColIdx == colCount)) {
      return;
    }
    console.log("render");

    while (firstRowTop < scrollTop - bufferHeight && firstRowIdx < rowCount - 1) {
      firstRowTop += rowVisible[firstRowIdx] * rowHeights[firstRowIdx];
      firstRowIdx++;
    }
    while (firstRowTop > scrollTop - bufferHeight && firstRowIdx > 0) {
      firstRowIdx--;
      firstRowTop -= rowVisible[firstRowIdx] * rowHeights[firstRowIdx];
    }
    while (firstColLeft < scrollLeft - bufferWidth && firstColIdx < colCount - 1) {
      firstColLeft += colVisible[firstColIdx] * colWidths[firstColIdx];
      firstColIdx++;
    }
    while (firstColLeft > scrollLeft - bufferWidth && firstColIdx > 0) {
      firstColIdx--;
      firstColLeft -= colVisible[firstColIdx] * colWidths[firstColIdx];
    }

    lastRowIdx = firstRowIdx;
    lastRowTop = firstRowTop;
    while (lastRowTop < scrollTop + offsetHeight + bufferHeight && lastRowIdx < rowCount) {
      lastRowTop += rowVisible[lastRowIdx] * rowHeights[lastRowIdx];
      lastRowIdx++;
    }
    lastColIdx = firstColIdx;
    lastColLeft = firstColLeft;
    while (lastColLeft < scrollLeft + offsetWidth + bufferWidth && lastColIdx < colCount) {
      lastColLeft += colVisible[lastColIdx] * colWidths[lastColIdx];
      lastColIdx++;
    }

    scrolled.textContent = ""; // Delete previously rendered content
    scrolled.style.height = totalHeight + "px";
    scrolled.style.width = totalWidth + "px";

    var table = document.createElement("table");
    var cellsVisible = false;
    for (var r = firstRowIdx; r < lastRowIdx; r++) {
      if (rowVisible[r] == 0) {
        continue;
      }
      var row = data.table[r];
      var tr = document.createElement("tr");
      for (var c = firstColIdx; c < lastColIdx; c++) {
        if (colVisible[c] == 0) {
          continue;
        }
        var cell = row[c];
        var td = document.createElement("td");
        td.className = "scrolltable-cell";
        if (r < headerRows || c < headerCols) {
          td.className += " header";
        }
        td.style.minWidth = colWidths[c] + "px";
        td.style.minHeight = rowHeights[r] + "px";
        data.renderCell(cell, td);
        tr.appendChild(td);
        cellsVisible = true;
      }
      table.appendChild(tr);
    }
    table.style.top = firstRowTop + "px";
    table.style.left = firstColLeft + "px";
    scrolled.appendChild(table);
    // Before this point we invalidate style and layout. After this point we recalculate style and layout, and we do not invalidate them again.
    if (cellsVisible) {
      tr = table.firstElementChild;
      for (var r = firstRowIdx; r < lastRowIdx; r++) {
        if (rowVisible[r] == 0) {
          continue;
        }
        var rowRect = tr.firstElementChild.getBoundingClientRect();
        var oldHeight = rowHeights[r];
        var newHeight = Math.max(oldHeight, rowRect.height);
        rowHeights[r] = newHeight;
        totalHeight += newHeight - oldHeight;
        lastRowTop += newHeight - oldHeight;
        tr = tr.nextElementSibling;
      }
      td = table.firstElementChild.firstElementChild;
      for (var c = firstColIdx; c < lastColIdx; c++) {
        if (colVisible[c] == 0) {
          continue;
        }
        var colRect = td.getBoundingClientRect();
        var oldWidth = colWidths[c];
        var newWidth = Math.max(oldWidth, colRect.width);
        colWidths[c] = newWidth;
        totalWidth += newWidth - oldWidth;
        lastColLeft += newWidth - oldWidth;
        td = td.nextElementSibling;
      }
    }
  }

  dataChange();
  dataObs.subscribe(dataChange);
  resizeObs.subscribe(viewportChange);
  scroller.addEventListener("scroll", viewportChange);
}
