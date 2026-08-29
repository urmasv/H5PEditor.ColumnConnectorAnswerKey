var H5PEditor = H5PEditor || {};

/**
 * Answer-key widget for H5P.ColumnConnector (v2 list-based schema).
 *
 * Each cell carries a "correctToPrevious" field rendered by this widget. It
 * resolves its own column's position inside the "columns" list and offers a
 * checkbox dropdown of the PREVIOUS column's cells. Selected cells are stored
 * as a JSON array of 1-based indices. The first column has no previous column,
 * so the widget hides itself there.
 *
 * The file also runs a small, defensive editor-form normalizer that:
 *  - keeps the "Behavioural settings" group heading correct,
 *  - removes the redundant expand/collapse-all control on the columns list,
 *  - relabels column/row wording to match the selected layout.
 */
H5PEditor.widgets.columnConnectorCellConnections = H5PEditor.ColumnConnectorCellConnections = (function ($) {
  'use strict';

  var EDITOR_LIBRARY = 'H5PEditor.ColumnConnectorAnswerKey';
  var DEFAULT_LIBRARY_STRINGS = {
    noNeighborCellsColumn: 'There are no cells in the previous column.',
    noNeighborCellsRow: 'There are no cells in the previous row.',
    noConnection: '— no connection —',
    connectionCount: '@count connections',
    cellFallback: 'cell',
    correctToPreviousColumn: 'Correct connections to the previous column',
    correctToPreviousRow: 'Correct connections to the previous row',
    columnWord: 'Column',
    rowWord: 'Row',
    columnsWord: 'Columns',
    rowsWord: 'Rows',
    addColumn: 'Add column',
    addRow: 'Add row',
    behaviourSettings: 'Behavioural settings',
    uploadImageButton: 'Upload image'
  };

  H5PEditor.language = H5PEditor.language || {};
  H5PEditor.language[EDITOR_LIBRARY] = H5PEditor.language[EDITOR_LIBRARY] || {};
  H5PEditor.language[EDITOR_LIBRARY].libraryStrings = $.extend(
    {},
    DEFAULT_LIBRARY_STRINGS,
    H5PEditor.language[EDITOR_LIBRARY].libraryStrings || {}
  );

  function t(key, replacements) {
    var value;
    var strings = H5PEditor.language && H5PEditor.language[EDITOR_LIBRARY] && H5PEditor.language[EDITOR_LIBRARY].libraryStrings;

    if (H5PEditor.t) {
      value = H5PEditor.t(EDITOR_LIBRARY, key);
    }
    if (!value || value === key) {
      value = strings && strings[key];
    }
    value = value || DEFAULT_LIBRARY_STRINGS[key] || '';

    $.each(replacements || {}, function (placeholder, replacement) {
      value = value.split(placeholder).join(replacement);
    });
    return value;
  }

  /* ======================================================================= *
   * Widget                                                                   *
   * ======================================================================= */

  function CellConnections(parent, field, params, setValue) {
    this.parent = parent;
    this.field = field;
    this.params = params || '';
    this.setValue = setValue;
    this.interval = null;
    this.lastSignature = '';
    this.$item = null;
    this.$label = null;
    this.$editor = null;
    this.$dropdown = null;
  }

  CellConnections.prototype.appendTo = function ($wrapper) {
    var self = this;
    var id = H5PEditor.getNextFieldId ? H5PEditor.getNextFieldId(this.field) : ('h5p-cc-cell-connections-' + Math.random().toString(36).slice(2));

    this.$item = $('<div>', {
      'class': 'field text h5p-column-connector-cell-connections'
    });

    this.$label = $('<label>', {
      'class': 'h5peditor-label',
      'for': id,
      text: this.getLabelText()
    }).appendTo(this.$item);

    if (this.field.description) {
      $('<div>', {
        'class': 'h5peditor-field-description',
        id: H5PEditor.getDescriptionId ? H5PEditor.getDescriptionId(id) : undefined,
        html: this.field.description
      }).appendTo(this.$item);
    }

    this.$editor = $('<div>', {
      'class': 'h5p-cc-cell-connection-editor',
      id: id
    }).appendTo(this.$item);

    this.$item.appendTo($wrapper);

    this.$item.on('click', function (event) {
      event.stopPropagation();
    });
    $(document).on('click.h5p-cc-cell-connections', function () {
      self.closeDropdown();
    });

    if (this.parent && typeof this.parent.ready === 'function') {
      this.parent.ready(function () {
        self.refreshIfNeeded(true);
        self.startWatching();
        expandImageExtra(self.parent);
        scheduleCollapseOnce(self.parent);
      });
    }
    else {
      this.refreshIfNeeded(true);
      this.startWatching();
      expandImageExtra(this.parent);
      scheduleCollapseOnce(this.parent);
    }
  };

  // Collapse every column/row and cell group once after the editor form is
  // ready (H5P ignores `collapsed:true` on list-item groups, so we call the
  // group instances' own collapse() — the same API the old widget relied on).
  function scheduleCollapseOnce(startNode) {
    if (window.__h5pCcCollapseDone) {
      return;
    }
    window.__h5pCcCollapseDone = true;
    window.setTimeout(function () {
      collapseAllListItems(startNode);
    }, 700);
  }

  function collapseGroupInstance(inst) {
    if (inst && typeof inst.collapse === 'function') {
      try { inst.collapse(); } catch (e) { /* best-effort */ }
    }
  }

  function expandGroupInstance(inst) {
    if (inst && typeof inst.expand === 'function') {
      try { inst.expand(); } catch (e) { /* best-effort */ }
    }
  }

  // Expand the imageExtra sub-group inside a cell's image group so its URL/alt
  // fields are visible directly (its heading is hidden via CSS, so it reads flat).
  function expandImageExtra(cellGroup) {
    var image = findChildInstanceByName(cellGroup, 'image');
    if (image) {
      expandGroupInstance(findChildInstanceByName(image, 'imageExtra'));
    }
  }

  function collapseAllListItems(startNode) {
    var columnsList = findAncestorByName(startNode, 'columns');
    if (!columnsList) {
      var columnGroup = findAncestorByName(startNode, 'column');
      columnsList = columnGroup ? findAncestorByName(columnGroup.parent, 'columns') : null;
    }
    if (!columnsList) {
      return;
    }
    $.each(listChildren(columnsList), function (i, columnGroup) {
      var cellsList = findChildInstanceByName(columnGroup, 'cells');
      if (cellsList) {
        $.each(listChildren(cellsList), function (j, cellGroup) {
          expandImageExtra(cellGroup);
          collapseGroupInstance(cellGroup);
        });
      }
      collapseGroupInstance(columnGroup);
    });
  }

  CellConnections.prototype.getLabelText = function () {
    return getLayoutMode() === 'rows' ? t('correctToPreviousRow') : t('correctToPreviousColumn');
  };

  CellConnections.prototype.startWatching = function () {
    var self = this;
    this.stopWatching();
    this.interval = window.setInterval(function () {
      self.refreshIfNeeded(false);
    }, 800);
  };

  CellConnections.prototype.stopWatching = function () {
    if (this.interval) {
      window.clearInterval(this.interval);
      this.interval = null;
    }
  };

  CellConnections.prototype.refreshIfNeeded = function (force) {
    var data = this.getEditorData();
    var layout = getLayoutMode();
    var signature = JSON.stringify({
      columnIndex: data.columnIndex,
      layout: layout,
      targetCells: data.previousCells.map(cellSignature)
    });

    if (!force && signature === this.lastSignature) {
      return;
    }
    this.lastSignature = signature;

    if (this.$label) {
      this.$label.text(this.getLabelText());
    }
    this.render(data, layout);
  };

  CellConnections.prototype.render = function (data, layout) {
    var self = this;
    var selected = parseSelectedIndices(this.params);
    var selectedMap = {};
    $.each(selected, function (index, oneBasedIndex) {
      selectedMap[oneBasedIndex] = true;
    });

    this.$editor.empty();

    // First column (or unresolved): no previous column to connect to.
    if (data.columnIndex <= 0) {
      this.$item.hide();
      return;
    }
    this.$item.show();

    var dropdownId = 'h5p-cc-cell-menu-' + data.columnIndex + '-' + Math.random().toString(36).slice(2);
    this.$dropdown = $('<div>', {
      'class': 'h5p-cc-cell-dropdown',
      'data-column-index': data.columnIndex
    }).appendTo(this.$editor);

    var $button = $('<button>', {
      type: 'button',
      'class': 'h5p-cc-cell-dropdown-button',
      'aria-expanded': 'false',
      'aria-controls': dropdownId
    }).appendTo(this.$dropdown);

    var $menu = $('<div>', {
      'class': 'h5p-cc-cell-dropdown-menu',
      id: dropdownId
    }).appendTo(this.$dropdown);

    if (!data.previousCells.length) {
      $('<div>', {
        'class': 'h5p-cc-cell-dropdown-empty',
        text: layout === 'rows' ? t('noNeighborCellsRow') : t('noNeighborCellsColumn')
      }).appendTo($menu);
    }

    $.each(data.previousCells, function (targetRowIndex, targetCell) {
      var oneBasedIndex = targetRowIndex + 1;
      var optionId = dropdownId + '-option-' + targetRowIndex;
      var label = getCellLabel(targetCell, targetRowIndex);
      var $label = $('<label>', {
        'class': 'h5p-cc-cell-option',
        'for': optionId
      }).appendTo($menu);

      $('<input>', {
        type: 'checkbox',
        id: optionId,
        value: oneBasedIndex,
        checked: !!selectedMap[oneBasedIndex]
      }).on('change', function () {
        self.updateDropdownLabel();
        self.storeFromDOM();
      }).appendTo($label);

      $('<span>', { text: label }).appendTo($label);
    });

    $button.on('click', function (event) {
      event.preventDefault();
      event.stopPropagation();
      var isOpen = self.$dropdown.hasClass('h5p-cc-cell-dropdown-open');
      self.closeDropdown();
      if (!isOpen) {
        self.$dropdown.addClass('h5p-cc-cell-dropdown-open');
        $button.attr('aria-expanded', 'true');
      }
    });

    this.updateDropdownLabel();
    this.storeFromDOM();
  };

  CellConnections.prototype.updateDropdownLabel = function () {
    var labels = [];
    if (!this.$dropdown) {
      return;
    }
    this.$dropdown.find('input:checked').each(function () {
      labels.push($(this).closest('label').find('span').text());
    });
    this.$dropdown.find('.h5p-cc-cell-dropdown-button').text(
      labels.length === 0 ? t('noConnection') :
        (labels.length === 1 ? labels[0] : t('connectionCount', { '@count': labels.length }))
    );
  };

  CellConnections.prototype.closeDropdown = function () {
    if (!this.$dropdown) {
      return;
    }
    this.$dropdown
      .removeClass('h5p-cc-cell-dropdown-open')
      .find('.h5p-cc-cell-dropdown-button')
      .attr('aria-expanded', 'false');
  };

  CellConnections.prototype.getEditorData = function () {
    var resolved = resolveFromInstances(this.parent);
    if (!resolved || (resolved.columnIndex > 0 && !resolved.previousCells.length)) {
      var domResolved = resolveFromDOM(this.$item);
      if (domResolved && (!resolved || domResolved.previousCells.length || domResolved.columnIndex <= 0)) {
        resolved = domResolved;
      }
    }
    if (!resolved) {
      return { columnIndex: -1, previousCells: [] };
    }
    return resolved;
  };

  CellConnections.prototype.storeFromDOM = function () {
    var selected = [];
    if (!this.$dropdown || !this.$item || this.$item.is(':hidden')) {
      return;
    }
    this.$dropdown.find('input:checked').each(function () {
      selected.push(parseInt($(this).val(), 10));
    });
    selected = uniqueSortedNumbers(selected);
    this.params = selected.length ? JSON.stringify(selected) : '';
    this.setValue(this.field, this.params || undefined);
  };

  CellConnections.prototype.validate = function () {
    return true;
  };

  CellConnections.prototype.remove = function () {
    this.stopWatching();
    $(document).off('click.h5p-cc-cell-connections');
    if (this.$item) {
      this.$item.remove();
    }
  };

  /* ======================================================================= *
   * Resolution via editor field instances (primary)                          *
   * ======================================================================= */

  function fieldName(node) {
    return (node && node.field && node.field.name) || null;
  }

  function findAncestorByName(node, name) {
    var guard = 0;
    while (node && guard < 60) {
      if (fieldName(node) === name) {
        return node;
      }
      node = node.parent;
      guard++;
    }
    return null;
  }

  function listChildren(list) {
    if (!list) {
      return [];
    }
    if ($.isArray(list.children)) {
      return list.children;
    }
    var collected = [];
    if (typeof list.forEachChild === 'function') {
      list.forEachChild(function (child) { collected.push(child); });
    }
    return collected;
  }

  function findChildInstanceByName(group, name) {
    var kids = listChildren(group);
    for (var i = 0; i < kids.length; i++) {
      if (fieldName(kids[i]) === name) {
        return kids[i];
      }
    }
    return null;
  }

  function cellsFromColumnInstance(colInstance, colParams) {
    var cellsList = findChildInstanceByName(colInstance, 'cells');
    if (cellsList && $.isArray(cellsList.params)) {
      return cellsList.params;
    }
    if (colInstance && colInstance.params && $.isArray(colInstance.params.cells)) {
      return colInstance.params.cells;
    }
    if (colParams && $.isArray(colParams.cells)) {
      return colParams.cells;
    }
    return [];
  }

  function resolveFromInstances(startNode) {
    var columnGroup = findAncestorByName(startNode, 'column');
    var columnsList = columnGroup ? findAncestorByName(columnGroup.parent, 'columns') : findAncestorByName(startNode, 'columns');
    if (!columnGroup || !columnsList) {
      return null;
    }

    var children = listChildren(columnsList);
    var columnIndex = -1;
    for (var i = 0; i < children.length; i++) {
      if (children[i] === columnGroup ||
        (children[i] && columnGroup.params && children[i].params === columnGroup.params)) {
        columnIndex = i;
        break;
      }
    }
    if (columnIndex < 0 && $.isArray(columnsList.params) && columnGroup.params) {
      columnIndex = columnsList.params.indexOf(columnGroup.params);
    }
    if (columnIndex < 0) {
      return null;
    }

    var previousCells = [];
    if (columnIndex > 0) {
      var prevInstance = children[columnIndex - 1];
      var prevParams = $.isArray(columnsList.params) ? columnsList.params[columnIndex - 1] : null;
      previousCells = cellsFromColumnInstance(prevInstance, prevParams);
    }

    return { columnIndex: columnIndex, previousCells: previousCells };
  }

  /* ======================================================================= *
   * Resolution via DOM (fallback)                                            *
   * ======================================================================= */

  function resolveFromDOM($item) {
    if (!$item || !$item.length) {
      return null;
    }
    var $columnItem = $item.closest('.field-name-column, [data-field-name="column"]');
    if (!$columnItem.length) {
      return null;
    }
    var $columnsList = $columnItem.closest('.field-name-columns, [data-field-name="columns"]');
    if (!$columnsList.length) {
      return null;
    }
    var $columns = $columnsList.find('.field-name-column, [data-field-name="column"]').filter(function () {
      return $(this).closest('.field-name-columns, [data-field-name="columns"]')[0] === $columnsList[0];
    });
    var columnIndex = $columns.index($columnItem);
    if (columnIndex < 0) {
      return null;
    }

    var previousCells = [];
    if (columnIndex > 0) {
      previousCells = readColumnCellsFromDOM($columns.eq(columnIndex - 1));
    }
    return { columnIndex: columnIndex, previousCells: previousCells };
  }

  function readColumnCellsFromDOM($column) {
    var cells = [];
    if (!$column || !$column.length) {
      return cells;
    }
    var $cellsList = $column.find('.field-name-cells, [data-field-name="cells"]').filter(function () {
      return $(this).closest('.field-name-column, [data-field-name="column"]')[0] === $column[0];
    }).first();
    if (!$cellsList.length) {
      return cells;
    }
    var $textFields = $cellsList.find('.field-name-text, [data-field-name="text"]').filter(function () {
      return $(this).closest('.field-name-cells, [data-field-name="cells"]')[0] === $cellsList[0];
    });
    $textFields.each(function () {
      cells.push({ text: readEditorTextField($(this)), alt: '' });
    });
    return cells;
  }

  function readEditorTextField($field) {
    var value = '';
    var $textarea = $field.find('textarea').first();
    if ($textarea.length) {
      value = $textarea.val();
    }
    if (!value) {
      var $input = $field.find('input[type="text"], input[type="hidden"]').first();
      if ($input.length) {
        value = $input.val();
      }
    }
    if (!value) {
      var $editable = $field.find('[contenteditable="true"]').first();
      if ($editable.length) {
        value = $editable.html();
      }
    }
    return value || '';
  }

  /* ======================================================================= *
   * Shared helpers                                                           *
   * ======================================================================= */

  function parseSelectedIndices(value) {
    var parsed;
    var result = [];
    if ($.isArray(value)) {
      parsed = value;
    }
    else if (typeof value === 'number') {
      parsed = [value];
    }
    else if (typeof value === 'string' && value.trim()) {
      try { parsed = JSON.parse(value); }
      catch (e) { parsed = value.split(','); }
    }
    else {
      parsed = [];
    }
    if (!$.isArray(parsed)) {
      parsed = [parsed];
    }
    $.each(parsed, function (index, item) {
      var number = parseInt(item, 10);
      if (number > 0) { result.push(number); }
    });
    return uniqueSortedNumbers(result);
  }

  function uniqueSortedNumbers(numbers) {
    var seen = {};
    var result = [];
    $.each(numbers, function (index, number) {
      number = parseInt(number, 10);
      if (number > 0 && !seen[number]) {
        seen[number] = true;
        result.push(number);
      }
    });
    result.sort(function (a, b) { return a - b; });
    return result;
  }

  function cellText(cell) {
    return (cell && cell.text) || '';
  }

  function cellAlt(cell) {
    if (!cell) {
      return '';
    }
    var image = cell.image;
    if (image && typeof image === 'object') {
      if (image.imageExtra && image.imageExtra.alt) {
        return image.imageExtra.alt;
      }
      if (image.alt) {
        return image.alt;
      }
    }
    return cell.alt || '';
  }

  function getCellLabel(cell, index) {
    var content = stripTags(cellText(cell)).trim() || String(cellAlt(cell)).trim();
    return (index + 1) + '. ' + (content || t('cellFallback'));
  }

  function cellSignature(cell) {
    return { text: cellText(cell), alt: cellAlt(cell) };
  }

  function stripTags(value) {
    return $('<div>').html(String(value || '')).text().replace(/\s+/g, ' ');
  }

  function getLayoutMode() {
    var value = null;
    $('select').each(function () {
      var $select = $(this);
      var optionValues = $select.find('option').map(function () {
        return String($(this).attr('value') || $(this).val() || '');
      }).get();
      if ($.inArray('columns', optionValues) !== -1 && $.inArray('rows', optionValues) !== -1) {
        value = $select.val();
        return false;
      }
    });
    return value === 'rows' ? 'rows' : 'columns';
  }

  /* ======================================================================= *
   * Editor-form normalization (defensive, best-effort)                       *
   * ======================================================================= */

  var normalizeTimer = null;
  function scheduleNormalize() {
    // Run soon after the triggering change, debounced so bursts collapse to one.
    if (normalizeTimer) {
      window.clearTimeout(normalizeTimer);
    }
    normalizeTimer = window.setTimeout(function () {
      normalizeTimer = null;
      normalizeAll();
    }, 120);
    // One delayed pass to catch late H5P re-renders.
    window.setTimeout(normalizeAll, 600);
  }

  var ASTERISK_FIELDS = ['layoutMode', 'lineStyle', 'position', 'size', 'align'];

  var mutationObserver = null;
  var applying = false;

  function normalizeAll() {
    if (applying) {
      return; // never re-enter (guards against observer feedback loops)
    }
    applying = true;
    if (mutationObserver) {
      mutationObserver.disconnect();
    }
    try {
      var layout = getLayoutMode();
      forceBehaviourHeading();
      relabelImageControls();
      removeColumnsCollapseAllControl();
      relabelColumnsAndRows(layout);
      suppressSelectAsterisks();
    }
    finally {
      if (mutationObserver && document.body) {
        mutationObserver.observe(document.body, { childList: true, subtree: true });
      }
      applying = false;
    }
  }

  function getColumnsRoot() {
    return $('.field-name-columns, [data-field-name="columns"]').first();
  }

  function ownText($el) {
    var text = '';
    $el.contents().each(function () {
      if (this.nodeType === 3) { text += this.nodeValue; }
    });
    return $.trim(text);
  }

  function uniqueTexts(list) {
    var seen = {};
    var out = [];
    $.each(list, function (i, v) {
      v = $.trim(String(v || ''));
      if (v && !seen[v]) { seen[v] = true; out.push(v); }
    });
    return out;
  }

  function setElementText($el, text) {
    var replaced = false;
    $el.contents().each(function () {
      if (this.nodeType === 3 && $.trim(this.nodeValue)) {
        this.nodeValue = text;
        replaced = true;
        return false;
      }
    });
    if (!replaced) {
      var $child = $el.find('.h5peditor-label-text, .h5peditor-title-text').first();
      if ($child.length) {
        $child.text(text);
      }
      else if (!$el.children().length) {
        $el.text(text);
      }
    }
  }

  // Force the behaviour group heading (H5P otherwise derives it from a child field value).
  // Relabel the file-upload "Add" button to "Lae pilt üles" (A). Scoped to the
  // image/file field wrappers (the old widget relied on these field-name classes).
  function relabelImageControls() {
    var desired = t('uploadImageButton');
    var aliases = ['Lisa', 'Add', 'Add file', 'Lisa fail', 'Upload', 'Lae üles'];
    $('.field-name-file, [data-field-name="file"], .field-name-image, [data-field-name="image"]')
      .find('button, a, .h5peditor-button').each(function () {
        var $b = $(this);
        var text = $.trim($b.text());
        if (text && text !== desired && $.inArray(text, aliases) !== -1) {
          setElementText($b, desired);
        }
      });
  }

  function forceBehaviourHeading() {
    var desired = t('behaviourSettings');
    var $groups = $('.field-name-behaviour, [data-field-name="behaviour"]');
    $groups.each(function () {
      var $label = $(this).children(
        '.h5peditor-label, .title, .h5peditor-field-title, legend, ' +
        '.h5peditor-group-title, .h5peditor-collapsible-title'
      ).first();
      if (!$label.length) {
        $label = $(this).find(
          '> .h5peditor-label-wrapper > .h5peditor-label, ' +
          '> .h5peditor-group > .title, > fieldset > legend'
        ).first();
      }
      if ($label.length && $.trim($label.text()) !== desired) {
        setElementText($label, desired);
      }
    });
  }

  // Remove the redundant "Collapse all content" / "Expand all content" control.
  // Scanned globally by text because the list wrapper's class is unreliable.
  function isCollapseAllText(text) {
    text = $.trim(text || '');
    return /(expand|collapse)\s+all/i.test(text) ||
      /(ahenda|laienda)[\s\S]*(sisu|kõik)/i.test(text);
  }

  function removeColumnsCollapseAllControl() {
    $('button, a, .h5peditor-button, .h5peditor-copypaste-wrap > *').each(function () {
      var $el = $(this);
      var text = ($el.text() || '') + ' ' + ($el.attr('title') || '') + ' ' + ($el.attr('aria-label') || '');
      if (isCollapseAllText(text)) {
        $el.remove();
      }
    });
    $('.h5p-cc-columns-collapse-all-control, .h5p-cc-collapse-columns-control').remove();
  }

  // Hide the required asterisk on the pre-defaulted select fields (H5P couples
  // the asterisk to `optional`, which would add an unwanted empty "-" option).
  function suppressSelectAsterisks() {
    $.each(ASTERISK_FIELDS, function (i, name) {
      $('.field-name-' + name + ', [data-field-name="' + name + '"]').each(function () {
        $(this).find('.h5peditor-label, label, .h5peditor-field-title, .title').each(function () {
          var $label = $(this);
          $label.removeClass('h5peditor-required');
          $label.contents().each(function () {
            if (this.nodeType === 3 && /\*/.test(this.nodeValue)) {
              this.nodeValue = this.nodeValue.replace(/\s*\*\s*$/, '');
            }
          });
          $label.children('.h5peditor-required, .h5peditor-required-star, .required').remove();
        });
      });
    });
  }

  function relabelColumnsAndRows(layout) {
    var rows = (layout === 'rows');
    var itemWord = rows ? t('rowWord') : t('columnWord');
    var listWord = rows ? t('rowsWord') : t('columnsWord');
    var addWord = rows ? t('addRow') : t('addColumn');

    // Map every known column/row wording variant to the layout-correct one.
    var map = {};
    map[$.trim(t('columnWord'))] = itemWord; map['Column'] = itemWord; map['Tulp'] = itemWord; map[$.trim(t('rowWord'))] = itemWord; map['Row'] = itemWord; map['Rida'] = itemWord;
    map[$.trim(t('columnsWord'))] = listWord; map['Columns'] = listWord; map['Tulbad'] = listWord; map[$.trim(t('rowsWord'))] = listWord; map['Rows'] = listWord; map['Read'] = listWord;
    map[$.trim(t('addColumn'))] = addWord; map['Add column'] = addWord; map['Lisa tulp'] = addWord; map[$.trim(t('addRow'))] = addWord; map['Add row'] = addWord; map['Lisa rida'] = addWord;

    // Scan the whole editor by exact own-text; class-based scoping proved
    // unreliable across H5P/Moodle/Lumi. Exclusions protect dropdown options,
    // cell content, and the answer-key widget's own controls.
    $('label, span, legend, div, button, a, .h5peditor-label, .title').each(function () {
      var $el = $(this);
      if ($el.children().length > 1) {
        return; // only leaf-ish label/title/button elements
      }
      if (this.tagName === 'OPTION' ||
        $el.closest('option, select, [contenteditable="true"], .ckeditor, .h5p-cc-cell-dropdown, .h5p-cc-cell-connection-editor').length) {
        return;
      }
      var text = ownText($el);
      if (!text) {
        return;
      }
      var desired = map[text];
      if (desired && desired !== text) {
        setElementText($el, desired);
      }
    });
  }

  function bindNormalization() {
    if ($(document.body).data('h5pCcNormalizationBound')) {
      return;
    }
    $(document.body).data('h5pCcNormalizationBound', true);

    $(document).on('change.h5p-cc-layout', 'select', function () {
      var optionValues = $(this).find('option').map(function () {
        return String($(this).attr('value') || $(this).val() || '');
      }).get();
      if ($.inArray('columns', optionValues) !== -1 && $.inArray('rows', optionValues) !== -1) {
        scheduleNormalize();
      }
    });

    $(document).on('click.h5p-cc-normalize', '.h5peditor-button, .h5peditor-collapsible-title, .h5peditor-group-title', function () {
      scheduleNormalize();
    });

    if (window.MutationObserver && document.body) {
      mutationObserver = new window.MutationObserver(function (mutations) {
        if (applying) {
          return; // ignore our own DOM changes
        }
        for (var i = 0; i < mutations.length; i++) {
          if (mutations[i].addedNodes && mutations[i].addedNodes.length) {
            scheduleNormalize();
            break;
          }
        }
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    // Light backstop only; the observer + events do the real work.
    window.setInterval(function () {
      if (!applying) {
        normalizeAll();
      }
    }, 3000);
  }

  $(function () {
    scheduleNormalize();
    bindNormalization();
  });

  return CellConnections;
})(H5P.jQuery);
