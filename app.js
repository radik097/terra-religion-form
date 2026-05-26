const STORAGE_KEY = "terra-srezannaya-religion-packages-v2";
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const svgIconSeed = dataUrlFromSvg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#160d22"/>
  <circle cx="256" cy="256" r="168" fill="none" stroke="#e8c67c" stroke-width="22"/>
  <path d="M256 108c44 78 70 132 70 188 0 57-29 96-70 96s-70-39-70-96c0-56 26-110 70-188z" fill="#a970ff"/>
  <circle cx="256" cy="285" r="38" fill="#f1ecdf" opacity=".9"/>
</svg>`);

const svgCitySeed = dataUrlFromSvg(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#090b16"/>
  <radialGradient id="g" cx="50%" cy="30%" r="70%"><stop offset="0" stop-color="#6d45c9" stop-opacity=".65"/><stop offset="1" stop-color="#090b16"/></radialGradient>
  <rect width="1280" height="720" fill="url(#g)"/>
  <path d="M0 560h1280v160H0z" fill="#10121f"/>
  <path d="M170 560V360h80v200h70V260h110v300h80V390h90v170h120V230h130v330h90V330h100v230h70V420h80v140z" fill="#1f2336"/>
  <path d="M250 360h80l40-90 40 90h70" fill="none" stroke="#e8c67c" stroke-width="14" opacity=".9"/>
  <circle cx="640" cy="170" r="74" fill="none" stroke="#e8c67c" stroke-width="8" opacity=".45"/>
</svg>`);

const fallbackReligions = [
  {
    id: "seed-violet-ovary",
    name: "Культ Баклажанной Завязи",
    author: "Канонический пример",
    basis: "Тело, симбионт, архив и вычислительный разум считаются частями одного выращивания будущего.",
    description: "Биотехнологическая теократия, где плодородие соединено с вычислительными садами и Всеобщим Разумом Завязи.",
    rulers: "Матрона Бакла Великая, Совет Маточников и закрытые вычислительные сады.",
    status: "ACCEPTED_CANON",
    tag: "VIOLET-OVARY",
    mapIcon: {
      originalName: "violet_ovary_icon.svg",
      mimeType: "image/svg+xml",
      sizeBytes: 0,
      dataUrl: svgIconSeed
    },
    cityPhoto: {
      originalName: "violet_ovary_city.svg",
      mimeType: "image/svg+xml",
      sizeBytes: 0,
      dataUrl: svgCitySeed
    },
    createdAt: "Канон"
  }
];

const fields = ["name", "author", "basis", "description", "rulers", "status", "tag"];
const imageFields = ["mapIcon", "cityPhoto"];

const form = document.querySelector("#religion-form");
const formStatus = document.querySelector("#form-status");
const cards = document.querySelector("#cards");
const template = document.querySelector("#card-template");
const searchInput = document.querySelector("#search");
const statusFilter = document.querySelector("#status-filter");
const resetButton = document.querySelector("#reset-form");
const exportButton = document.querySelector("#export-json");
const importInput = document.querySelector("#import-json");
const clearButton = document.querySelector("#clear-all");
const localCount = document.querySelector("#local-count");

const mapIconInput = document.querySelector("#map-icon");
const cityPhotoInput = document.querySelector("#city-photo");
const mapIconName = document.querySelector("#map-icon-name");
const cityPhotoName = document.querySelector("#city-photo-name");
const mapIconPreview = document.querySelector("#map-icon-preview");
const cityPhotoPreview = document.querySelector("#city-photo-preview");

let religions = loadReligions();
render();

mapIconInput.addEventListener("change", () => previewSelectedFile(mapIconInput, mapIconName, mapIconPreview));
cityPhotoInput.addEventListener("change", () => previewSelectedFile(cityPhotoInput, cityPhotoName, cityPhotoPreview));

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Проверяю поля и изображения...");

  try {
    const formData = new FormData(form);
    const normalized = await normalizeReligion(formData);
    const validation = validateReligion(normalized);

    if (!validation.ok) {
      setStatus(validation.message, true);
      return;
    }

    religions = [normalized, ...religions];
    saveReligions(religions);
    form.reset();
    resetPreviews();
    setStatus("Запись сохранена. ZIP можно скачать в карточке религии.");
    render();
  } catch (error) {
    setStatus(`Ошибка: ${error.message}`, true);
  }
});

resetButton.addEventListener("click", () => {
  form.reset();
  resetPreviews();
  setStatus("Форма очищена.");
});

searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", render);

exportButton.addEventListener("click", () => {
  const payload = {
    project: "Terra Srezannaya Religion Package Registry",
    version: "2.0.0",
    exportedAt: new Date().toISOString(),
    count: religions.length,
    religions
  };

  downloadBlob(
    JSON.stringify(payload, null, 2),
    `terra-religion-registry-${new Date().toISOString().slice(0, 10)}.json`,
    "application/json"
  );
});

importInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = Array.isArray(parsed) ? parsed : parsed.religions;

    if (!Array.isArray(imported)) {
      throw new Error("В JSON не найден массив religions.");
    }

    const cleaned = imported.map(normalizeImportedReligion).filter(Boolean);
    const byId = new Map([...cleaned, ...religions].map((item) => [item.id, item]));
    religions = [...byId.values()];
    saveReligions(religions);
    setStatus(`Импортировано записей: ${cleaned.length}.`);
    render();
  } catch (error) {
    setStatus(`Ошибка импорта: ${error.message}`, true);
  } finally {
    importInput.value = "";
  }
});

clearButton.addEventListener("click", () => {
  religions = [...fallbackReligions];
  saveReligions(religions);
  setStatus("Локальные пользовательские записи удалены. Канонический пример оставлен.");
  render();
});

async function normalizeReligion(formData) {
  const now = new Date();
  const base = Object.fromEntries(fields.map((field) => [field, clean(formData.get(field))]));

  const mapIcon = await fileToStoredImage(formData.get("mapIcon"), "значок на карте");
  const cityPhoto = await fileToStoredImage(formData.get("cityPhoto"), "фото города");

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `religion-${Date.now()}`,
    ...base,
    tag: base.tag || slugify(base.name).toUpperCase(),
    mapIcon,
    cityPhoto,
    createdAt: now.toISOString()
  };
}

function normalizeImportedReligion(item) {
  if (!item || typeof item !== "object") return null;

  const normalized = {
    id: clean(item.id) || (crypto.randomUUID ? crypto.randomUUID() : `religion-${Date.now()}-${Math.random()}`),
    ...Object.fromEntries(fields.map((field) => [field, clean(item[field])])),
    mapIcon: normalizeStoredImage(item.mapIcon),
    cityPhoto: normalizeStoredImage(item.cityPhoto),
    createdAt: clean(item.createdAt) || new Date().toISOString()
  };

  normalized.tag = normalized.tag || slugify(normalized.name).toUpperCase();
  return validateReligion(normalized).ok ? normalized : null;
}

function normalizeStoredImage(image) {
  if (!image || typeof image !== "object") return null;
  const dataUrl = clean(image.dataUrl);
  if (!dataUrl.startsWith("data:image/")) return null;

  return {
    originalName: clean(image.originalName) || "image.png",
    mimeType: clean(image.mimeType) || mimeFromDataUrl(dataUrl),
    sizeBytes: Number(image.sizeBytes) || dataUrlToBytes(dataUrl).length,
    dataUrl
  };
}

function validateReligion(item) {
  for (const field of ["name", "author", "basis", "description", "rulers", "status"]) {
    if (!item[field]) {
      return { ok: false, message: `Поле "${field}" не заполнено.` };
    }
  }

  for (const field of imageFields) {
    if (!item[field]?.dataUrl) {
      return { ok: false, message: `Не добавлено изображение: ${field}.` };
    }
  }

  return { ok: true };
}

async function fileToStoredImage(file, label) {
  if (!(file instanceof File) || !file.name) {
    throw new Error(`Не выбран файл: ${label}.`);
  }

  if (!file.type.startsWith("image/")) {
    throw new Error(`Файл "${file.name}" не является изображением.`);
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Файл "${file.name}" слишком большой. Максимум 3 MB для стабильного localStorage.`);
  }

  const dataUrl = await readFileAsDataUrl(file);
  return {
    originalName: file.name,
    mimeType: file.type || mimeFromName(file.name),
    sizeBytes: file.size,
    dataUrl
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Не удалось прочитать файл "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

async function previewSelectedFile(input, nameNode, previewNode) {
  const file = input.files?.[0];
  if (!file) {
    nameNode.textContent = "Файл не выбран";
    previewNode.hidden = true;
    previewNode.removeAttribute("src");
    return;
  }

  nameNode.textContent = `${file.name} / ${formatBytes(file.size)}`;

  if (file.size > MAX_IMAGE_BYTES) {
    setStatus(`Файл "${file.name}" больше 3 MB. Выбери меньший файл.`, true);
    previewNode.hidden = true;
    return;
  }

  const dataUrl = await readFileAsDataUrl(file);
  previewNode.src = dataUrl;
  previewNode.hidden = false;
}

function resetPreviews() {
  mapIconName.textContent = "Файл не выбран";
  cityPhotoName.textContent = "Файл не выбран";
  mapIconPreview.hidden = true;
  cityPhotoPreview.hidden = true;
  mapIconPreview.removeAttribute("src");
  cityPhotoPreview.removeAttribute("src");
}

function loadReligions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveReligions(fallbackReligions);
      return [...fallbackReligions];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...fallbackReligions];
    const cleaned = parsed.map(normalizeImportedReligion).filter(Boolean);
    return cleaned.length ? cleaned : [...fallbackReligions];
  } catch {
    return [...fallbackReligions];
  }
}

function saveReligions(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items, null, 2));
  } catch (error) {
    setStatus("Браузер не смог сохранить запись. Вероятно, изображения слишком большие.", true);
    throw error;
  }
}

function render() {
  const query = searchInput.value.trim().toLowerCase();
  const status = statusFilter.value;
  const filtered = religions.filter((item) => {
    const haystack = [item.name, item.author, item.basis, item.description, item.rulers, item.tag].join(" ").toLowerCase();
    return (status === "ALL" || item.status === status) && (!query || haystack.includes(query));
  });

  localCount.textContent = String(religions.filter((item) => !item.id.startsWith("seed-")).length);
  cards.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Записей не найдено. Создай новую религию или измени фильтр.";
    cards.append(empty);
    return;
  }

  for (const religion of filtered) {
    cards.append(createCard(religion));
  }
}

function createCard(religion) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector("h3").textContent = religion.name;
  node.querySelector(".religion-card__status").textContent = `${religion.status} / ${religion.tag || "NO-TAG"}`;
  node.querySelector(".religion-card__summary").textContent = religion.description;
  node.querySelector(".card-icon").src = religion.mapIcon.dataUrl;
  node.querySelector(".card-city").src = religion.cityPhoto.dataUrl;

  const deleteButton = node.querySelector(".icon-button");
  if (religion.id.startsWith("seed-")) {
    deleteButton.remove();
  } else {
    deleteButton.addEventListener("click", () => {
      religions = religions.filter((item) => item.id !== religion.id);
      saveReligions(religions);
      render();
    });
  }

  const details = [
    ["Автор", religion.author],
    ["Основа религии", religion.basis],
    ["Действующие правители", religion.rulers],
    ["Значок карты", religion.mapIcon.originalName],
    ["Фото города", religion.cityPhoto.originalName]
  ];

  const dl = node.querySelector("dl");
  for (const [term, value] of details) {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = term;
    dd.textContent = value;
    wrapper.append(dt, dd);
    dl.append(wrapper);
  }

  node.querySelector(".created-at").textContent = formatDate(religion.createdAt);
  node.querySelector(".download-package").addEventListener("click", () => downloadReligionZip(religion));
  return node;
}

async function downloadReligionZip(religion) {
  try {
    const packageFiles = buildReligionPackageFiles(religion);
    const zipBlob = createZip(packageFiles);
    const fileName = `${slugify(religion.name || "religion")}_religion_package.zip`;
    downloadBlob(zipBlob, fileName, "application/zip");
    setStatus(`ZIP создан: ${fileName}`);
  } catch (error) {
    setStatus(`Ошибка ZIP: ${error.message}`, true);
  }
}

function buildReligionPackageFiles(religion) {
  const folder = slugify(religion.name || religion.tag || "religion");
  const mapExt = extensionFromImage(religion.mapIcon);
  const cityExt = extensionFromImage(religion.cityPhoto);
  const mapPath = `${folder}/assets/map_icon.${mapExt}`;
  const cityPath = `${folder}/assets/city_photo.${cityExt}`;
  const mdPath = `${folder}/RELIGION.md`;
  const jsonPath = `${folder}/index.json`;

  const index = {
    type: "terra_srezannaya_religion_package",
    version: "1.0.0",
    created_at: new Date().toISOString(),
    religion: {
      id: religion.id,
      name: religion.name,
      author: religion.author,
      basis: religion.basis,
      description: religion.description,
      rulers: religion.rulers,
      status: religion.status,
      tag: religion.tag
    },
    files: [
      {
        role: "map_icon",
        path: "assets/map_icon." + mapExt,
        original_name: religion.mapIcon.originalName,
        mime_type: religion.mapIcon.mimeType,
        size_bytes: religion.mapIcon.sizeBytes
      },
      {
        role: "city_photo",
        path: "assets/city_photo." + cityExt,
        original_name: religion.cityPhoto.originalName,
        mime_type: religion.cityPhoto.mimeType,
        size_bytes: religion.cityPhoto.sizeBytes
      },
      {
        role: "religion_markdown",
        path: "RELIGION.md",
        mime_type: "text/markdown"
      },
      {
        role: "package_index",
        path: "index.json",
        mime_type: "application/json"
      }
    ],
    user_requirements: {
      required_text_fields: ["author", "basis", "description", "rulers"],
      required_images: ["map_icon", "city_photo"],
      answer_rule: "one_short_sentence_per_field"
    },
    validation_notes: [
      "Новая религия не становится каноном автоматически.",
      "Пакет нужно передать летописцу или администратору лора.",
      "Крупные изменения мира требуют отдельного согласования."
    ]
  };

  const markdown = `# ${religion.name}\n\n` +
    `## Автор\n\n${religion.author}\n\n` +
    `## Основа религии\n\n${religion.basis}\n\n` +
    `## Описание религии\n\n${religion.description}\n\n` +
    `## Действующие правители\n\n${religion.rulers}\n\n` +
    `## Статус канона\n\n${religion.status}\n\n` +
    `## Файлы\n\n` +
    `- Значок на карте: \`${mapPath.replace(folder + "/", "")}\`\n` +
    `- Фото города: \`${cityPath.replace(folder + "/", "")}\`\n` +
    `- JSON индекс: \`index.json\`\n\n` +
    `## Примечание\n\nЭтот пакет создан через статическую форму GitHub Pages. Он является заявкой на добавление религии, а не автоматическим принятием в основной канон.\n`;

  return [
    { path: jsonPath, data: textToBytes(JSON.stringify(index, null, 2)) },
    { path: mdPath, data: textToBytes(markdown) },
    { path: mapPath, data: dataUrlToBytes(religion.mapIcon.dataUrl) },
    { path: cityPath, data: dataUrlToBytes(religion.cityPhoto.dataUrl) }
  ];
}

function createZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = textToBytes(file.path);
    const data = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const crc = crc32(data);
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);

    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    localHeader.set(nameBytes, 30);

    chunks.push(localHeader, data);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralHeader.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, data.length, true);
    centralView.setUint32(24, data.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    centralHeader.set(nameBytes, 46);
    central.push(centralHeader);

    offset += localHeader.length + data.length;
  }

  const centralOffset = offset;
  let centralSize = 0;
  for (const item of central) centralSize += item.length;

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, centralOffset, true);
  endView.setUint16(20, 0, true);

  return new Blob([...chunks, ...central, end], { type: "application/zip" });
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function textToBytes(text) {
  return new TextEncoder().encode(text);
}

function dataUrlToBytes(dataUrl) {
  const base64 = String(dataUrl).split(",")[1] || "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function dataUrlFromSvg(svg) {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg.trim())))}`;
}

function mimeFromDataUrl(dataUrl) {
  const match = String(dataUrl).match(/^data:([^;]+);/);
  return match ? match[1] : "application/octet-stream";
}

function mimeFromName(name) {
  const ext = name.toLowerCase().split(".").pop();
  const map = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", svg: "image/svg+xml" };
  return map[ext] || "application/octet-stream";
}

function extensionFromImage(image) {
  const nameExt = clean(image.originalName).toLowerCase().split(".").pop();
  if (["png", "jpg", "jpeg", "webp", "svg"].includes(nameExt)) return nameExt === "jpeg" ? "jpg" : nameExt;

  const mime = image.mimeType || mimeFromDataUrl(image.dataUrl);
  if (mime.includes("svg")) return "svg";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  return "png";
}

function downloadBlob(data, fileName, mimeType) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function slugify(value) {
  const translit = String(value || "religion")
    .toLowerCase()
    .replace(/[а]/g, "a").replace(/[б]/g, "b").replace(/[в]/g, "v")
    .replace(/[г]/g, "g").replace(/[д]/g, "d").replace(/[её]/g, "e")
    .replace(/[ж]/g, "zh").replace(/[з]/g, "z").replace(/[и]/g, "i")
    .replace(/[й]/g, "y").replace(/[к]/g, "k").replace(/[л]/g, "l")
    .replace(/[м]/g, "m").replace(/[н]/g, "n").replace(/[о]/g, "o")
    .replace(/[п]/g, "p").replace(/[р]/g, "r").replace(/[с]/g, "s")
    .replace(/[т]/g, "t").replace(/[у]/g, "u").replace(/[ф]/g, "f")
    .replace(/[х]/g, "h").replace(/[ц]/g, "c").replace(/[ч]/g, "ch")
    .replace(/[ш]/g, "sh").replace(/[щ]/g, "sch").replace(/[ъь]/g, "")
    .replace(/[ы]/g, "y").replace(/[э]/g, "e").replace(/[ю]/g, "yu")
    .replace(/[я]/g, "ya")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return translit || "religion";
}

function formatDate(value) {
  if (value === "Канон") return "Канонический пример";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `Создано: ${date.toLocaleString("ru-RU")}`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function setStatus(message, isError = false) {
  formStatus.textContent = message;
  formStatus.style.color = isError ? "var(--red)" : "var(--dim)";
}
