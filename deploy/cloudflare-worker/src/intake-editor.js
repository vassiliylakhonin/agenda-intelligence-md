// Kept as browser source: serializing bundled nested functions would capture
// Wrangler's out-of-scope keepNames helpers. No network or storage in the editor.
export const INTAKE_CLIENT_SCRIPT = String.raw`
function mountIntakeEditor(root, requestBox, template, options) {
  if (!root || !root.appendChild) return;
  var templates = {};
  var count = 0;
  function label(key) {
    return String(key).replace(/_/g, ' ').replace(/\b\w/g, function(c) { return c.toUpperCase(); })
      .replace(/\b(?:Hs|Eccn|Id|Ids|Utc|Usd|Json|Sha)\b/g, function(word) { return word.toUpperCase(); });
  }
  function node(tag, text) {
    var element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    return element;
  }
  function blank(value) {
    if (Array.isArray(value)) return [];
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(function(entry) { return [entry[0], blank(entry[1])]; }));
    return typeof value === 'string' ? '' : null;
  }
  function remember(value, path) {
    if (Array.isArray(value)) {
      if (value.length) { templates[path] = value[0]; remember(value[0], path + '.*'); }
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(function(entry) { remember(entry[1], path ? path + '.' + entry[0] : entry[0]); });
    }
  }
  remember(template, '');
  function parse() {
    var value = JSON.parse(requestBox.value);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The request must be a JSON object.');
    return value;
  }
  function save(value) { requestBox.value = JSON.stringify(value, null, 2); }
  function resolveSchema(schema) {
    for (var depth = 0; depth < 10 && schema && schema.$ref && schema.$ref.startsWith('#/'); depth++) {
      var pointer = schema.$ref.slice(2).split('/'); schema = options.schema;
      pointer.forEach(function(part) { schema = schema && schema[part.replace(/~1/g, '/').replace(/~0/g, '~')]; });
    }
    return schema || {};
  }
  function fieldSchema(path) {
    var schema = options && options.schema || {};
    path.split('.').forEach(function(part) {
      schema = resolveSchema(schema);
      var branches = schema.oneOf || schema.anyOf;
      if (branches) schema = branches.map(resolveSchema).find(function(branch) { return branch.properties && Object.hasOwn(branch.properties, part); }) || schema;
      schema = /^\d+$/.test(part) ? schema.items || {} : schema.properties && schema.properties[part] || {};
    });
    return resolveSchema(schema);
  }
  function draw(value, target, path, parent, key, depth) {
    if (++count > 180 || depth > 8) { target.appendChild(node('p', 'Additional fields remain in Structured request JSON.')); return; }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      var group = path && typeof key !== 'number' ? node('fieldset') : target;
      if (group !== target) { group.appendChild(node('legend', label(key))); target.appendChild(group); }
      Object.entries(value).forEach(function(entry) { draw(entry[1], group, path ? path + '.' + entry[0] : entry[0], value, entry[0], depth + 1); });
      return;
    }
    if (Array.isArray(value)) {
      var section = node('fieldset'); section.appendChild(node('legend', label(key))); target.appendChild(section);
      var templatePath = path.replace(/\.\d+(?=\.|$)/g, '.*');
      var itemTemplate = templates[templatePath];
      if (itemTemplate === undefined && /(?:dated_sources|supplied_sources)$/.test(path)) itemTemplate = {id:'',source_type:'',title:'',date:''};
      value.forEach(function(item, index) {
        var row = node('fieldset'); row.appendChild(node('legend', 'Item ' + (index + 1))); section.appendChild(row);
        draw(item, row, path + '.' + index, value, index, depth + 1);
        var remove = node('button', 'Remove item'); remove.type = 'button';
        remove.onclick = function() { value.splice(index, 1); save(current); render(); }; row.appendChild(remove);
      });
      var add = node('button', 'Add ' + label(key).toLowerCase() + ' item'); add.type = 'button';
      add.onclick = function() { value.push(blank(itemTemplate === undefined ? '' : itemTemplate)); save(current); render(); };
      section.appendChild(add);
      return;
    }
    var sample = template;
    path.split('.').forEach(function(part) { sample = Array.isArray(sample) ? sample[0] : sample && sample[part]; });
    var kind = value === null ? typeof sample : typeof value;
    var schema = fieldSchema(path);
    var field = node('div'); field.style.marginBottom = '12px';
    var title = node('label', typeof key === 'number' ? 'Value' : label(key)); title.style.display = 'block';
    var input = node(Array.isArray(schema.enum) ? 'select' : typeof value === 'string' && (value.length > 120 || /text|excerpt|question|description|claim|intent|prompt|artifact/i.test(key)) ? 'textarea' : 'input');
    if (Array.isArray(schema.enum)) {
      [value, ...schema.enum].filter(function(item, index, values) { return values.indexOf(item) === index; }).forEach(function(item) {
        var option = node('option', item === null || item === '' ? 'Choose a value' : label(item));
        option.value = item === null ? '' : String(item); input.appendChild(option);
      });
    }
    input.id = 'intake-' + path; title.htmlFor = input.id;
    input.style.width = '100%'; input.style.boxSizing = 'border-box';
    if (kind === 'number') { input.type = 'number'; input.step = 'any'; }
    else if (kind === 'boolean') input.type = 'checkbox';
    else if (input.tagName === 'INPUT') input.type = 'text';
    if (typeof value === 'boolean') input.checked = value;
    else input.value = value === null ? '' : String(value);
    input.oninput = function() {
      parent[key] = kind === 'number' ? (input.value === '' ? null : Number(input.value)) :
        kind === 'boolean' ? input.checked : input.value;
      save(current);
    };
    field.appendChild(title); field.appendChild(input);
    if (typeof schema.description === 'string') field.appendChild(node('small', schema.description));
    target.appendChild(field);
  }
  var current;
  function render() {
    try {
      current = parse(); root.replaceChildren(); count = 0;
      draw(current, root, '', null, '', 0);
      (options && options.optional || []).forEach(function(spec) {
        var parts = spec.path.split('.'), parent = current;
        parts.slice(0, -1).forEach(function(part) { parent = parent && parent[part]; });
        var key = parts[parts.length - 1];
        if (!parent || Object.hasOwn(parent, key)) return;
        var field = node('div'), title = node('label', spec.label + ' (optional)');
        var input = node('textarea'); input.id = 'intake-' + spec.path; title.htmlFor = input.id;
        input.style.width = '100%'; title.style.display = 'block';
        input.oninput = function() {
          try {
            if (input.value === '') delete parent[key];
            else parent[key] = spec.json ? JSON.parse(input.value) : input.value;
            input.setCustomValidity(''); save(current);
          } catch (_error) { input.setCustomValidity('Enter a JSON value, or clear this optional field.'); }
        };
        field.appendChild(title); field.appendChild(input); root.appendChild(field);
      });
    } catch (error) { root.replaceChildren(node('p', 'Correct Structured request JSON, then update the fields: ' + error.message)); }
  }
  root.updateFromJson = render;
  root.startBlank = function() { save(blank(template)); render(); };
  requestBox.addEventListener('change', render);
  render();
}
`;
