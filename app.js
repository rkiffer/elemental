import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, deleteDoc, onSnapshot,
  query, where, serverTimestamp, getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// Coleções exclusivas do projeto Elemental. Isso evita carregar os personagens
// e spots do projeto original, mesmo usando o mesmo Firebase.
const CHARACTERS_COLLECTION = "elemental_characters";
const SPOTS_COLLECTION = "elemental_spots";

const MAPS = [
  { id: "Alkamar", name: "Alkamar", file: "assets/maps/Alkamar.png" },
  { id: "Ubaid", name: "Ubaid", file: "assets/maps/Ubaid.png" },
  { id: "Debenter", name: "Debenter", file: "assets/maps/Debenter.png" },
  { id: "Uruk", name: "Uruk", file: "assets/maps/Uruk.png" },
  { id: "Nars", name: "Nars", file: "assets/maps/Nars.png" }
];

const SERVERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18];
const $ = id => document.getElementById(id);
const els = {
  mapSelect: $("mapSelect"), serverSelect: $("serverSelect"), mapImage: $("mapImage"),
  mapInner: $("mapInner"), spotsLayer: $("spotsLayer"), currentMapName: $("currentMapName"),
  currentServerName: $("currentServerName"), charactersList: $("charactersList"),
  characterSearch: $("characterSearch"), spotsCount: $("spotsCount"), charsCount: $("charsCount"),
  lastUpdate: $("lastUpdate"), showNamesToggle: $("showNamesToggle"), spotDialog: $("spotDialog"),
  spotCharacterSelect: $("spotCharacterSelect"), saveSpotBtn: $("saveSpotBtn"),
  characterDialog: $("characterDialog"), charNameInput: $("charNameInput"),
  charColorInput: $("charColorInput"), saveCharacterBtn: $("saveCharacterBtn"),
  charModalTitle: $("charModalTitle"), addCharacterBtn: $("addCharacterBtn"),
  spotInspector: $("spotInspector"), clearMapBtn: $("clearMapBtn"),
  clearMapBtn2: $("clearMapBtn2"), exportBtn: $("exportBtn"), shareBtn: $("shareBtn"),
  centerMapBtn: $("centerMapBtn")
};

const params = new URLSearchParams(location.search);
let currentMap = params.get("map") || "Alkamar";
let currentServer = params.get("server") || "1";
let characters = [];
let spots = [];
let pendingSpot = null;
let selectedSpotId = null;
let editingCharacterId = null;
let unsubChars = null;
let unsubSpots = null;

function toast(message) {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("show");
  setTimeout(() => element.classList.remove("show"), 2200);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;"
  })[char]);
}

function randomColor() {
  const colors = ["#31d978", "#64f0a0", "#e2bd55", "#55d8d0", "#6a9dff", "#b477ff", "#ff718b", "#ff9d55"];
  return colors[Math.floor(Math.random() * colors.length)];
}

function mapInfo() {
  return MAPS.find(map => map.id === currentMap) || MAPS[0];
}

function areaKey() {
  return `${currentMap}__S${currentServer}`;
}

function updateUrl() {
  const url = new URL(location.href);
  url.searchParams.set("map", currentMap);
  url.searchParams.set("server", currentServer);
  history.replaceState(null, "", url.toString());
}

function nowLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function initSelectors() {
  els.mapSelect.innerHTML = MAPS.map(map => `<option value="${map.id}">${map.name}</option>`).join("");
  els.serverSelect.innerHTML = SERVERS.map(server => `<option value="${server}">Servidor ${server}</option>`).join("");

  if (!MAPS.some(map => map.id === currentMap)) currentMap = MAPS[0].id;
  if (!SERVERS.includes(Number(currentServer))) currentServer = String(SERVERS[0]);

  els.mapSelect.value = currentMap;
  els.serverSelect.value = currentServer;
  loadArea();
}

function loadArea() {
  const map = mapInfo();
  els.currentMapName.textContent = map.name;
  els.currentServerName.textContent = `Servidor ${currentServer}`;
  els.mapSelect.value = currentMap;
  els.serverSelect.value = currentServer;
  els.mapImage.src = map.file;
  els.mapImage.alt = `${map.name} - Servidor ${currentServer}`;
  selectedSpotId = null;
  updateUrl();
  subscribeSpots();
}

function subscribeCharacters() {
  if (unsubChars) unsubChars();
  unsubChars = onSnapshot(collection(db, CHARACTERS_COLLECTION), snapshot => {
    characters = snapshot.docs
      .map(document => ({ id: document.id, ...document.data() }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));
    renderCharacters();
    renderCharacterOptions();
    renderStats();
  }, error => {
    console.error(error);
    toast("Erro ao carregar personagens");
  });
}

function subscribeSpots() {
  if (unsubSpots) unsubSpots();
  const spotsQuery = query(collection(db, SPOTS_COLLECTION), where("areaKey", "==", areaKey()));
  unsubSpots = onSnapshot(spotsQuery, snapshot => {
    spots = snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
    renderSpots();
    renderStats();
  }, error => {
    console.error(error);
    toast("Erro ao carregar spots");
  });
}

function renderCharacters() {
  const term = els.characterSearch.value.trim().toLowerCase();
  const filtered = characters.filter(character => String(character.name).toLowerCase().includes(term));
  els.charactersList.innerHTML = filtered.map(character => `
    <div class="char-row" data-id="${character.id}">
      <span class="dot" style="color:${character.color};background:${character.color}"></span>
      <span class="char-name">${escapeHtml(character.name)}</span>
      <button class="text-btn edit-char" type="button">Editar</button>
      <button class="x-btn delete-char" type="button" aria-label="Excluir">×</button>
    </div>`).join("") || '<p class="muted empty-state">Nenhum personagem adicionado.</p>';
}

function renderCharacterOptions() {
  els.spotCharacterSelect.innerHTML = characters
    .map(character => `<option value="${character.id}">${escapeHtml(character.name)}</option>`)
    .join("");
}

function renderStats() {
  els.spotsCount.textContent = `${spots.length} / 500`;
  els.charsCount.textContent = characters.length;
  els.lastUpdate.textContent = nowLabel();
}

function renderSpots() {
  els.spotsLayer.innerHTML = spots.map(spot => {
    const color = spot.color || "#31d978";
    const hiddenName = els.showNamesToggle.checked ? "" : " hide-name";
    const selected = selectedSpotId === spot.id ? " selected" : "";
    return `<div class="spot${hiddenName}${selected}" data-id="${spot.id}" style="left:${spot.x}%;top:${spot.y}%;color:${color}">
      <span class="spot-dot" style="background:${color}"></span>
      <span class="spot-label">${escapeHtml(spot.charName || "Sem nome")}</span>
    </div>`;
  }).join("");
  renderInspector();
}

function renderInspector() {
  const spot = spots.find(item => item.id === selectedSpotId);
  if (!spot) {
    els.spotInspector.innerHTML = '<h3>Spot Selecionado</h3><p class="muted">Clique em um spot para editar ou excluir.</p>';
    return;
  }
  els.spotInspector.innerHTML = `
    <h3>Spot Selecionado</h3>
    <div class="inspector-row"><span>Mapa</span><strong>${escapeHtml(mapInfo().name)}</strong></div>
    <div class="inspector-row"><span>Servidor</span><strong>${escapeHtml(currentServer)}</strong></div>
    <div class="inspector-row"><span>Char</span><strong>${escapeHtml(spot.charName || "--")}</strong></div>
    <div class="inspector-row"><span>X / Y</span><strong>${Number(spot.x).toFixed(1)}% / ${Number(spot.y).toFixed(1)}%</strong></div>
    <button class="wide green-outline" id="editSpotBtn" type="button">Editar Spot</button>
    <button class="wide danger-outline" id="deleteSpotBtn" type="button">Excluir Spot</button>`;
  $("editSpotBtn").onclick = () => openSpotDialogForEdit(spot);
  $("deleteSpotBtn").onclick = () => deleteSpot(spot.id);
}

function pointToPercent(event) {
  const rect = els.mapInner.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
    y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
  };
}

function clickInsideMap(event) {
  const rect = els.mapInner.getBoundingClientRect();
  return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
}

function openSpotDialogForNew(event) {
  if (event.target.closest(".spot") || !clickInsideMap(event)) return;
  if (characters.length === 0) {
    toast("Adicione um personagem primeiro");
    return;
  }
  pendingSpot = { ...pointToPercent(event), mode: "new" };
  els.spotCharacterSelect.value = characters[0].id;
  $("modalTitle").textContent = "Adicionar Spot";
  els.spotDialog.showModal();
}

function openSpotDialogForEdit(spot) {
  pendingSpot = { ...spot, mode: "edit" };
  els.spotCharacterSelect.value = spot.charId || characters[0]?.id || "";
  $("modalTitle").textContent = "Editar Spot";
  els.spotDialog.showModal();
}

async function saveSpot() {
  if (!pendingSpot) return;
  const character = characters.find(item => item.id === els.spotCharacterSelect.value);
  if (!character) {
    toast("Selecione um personagem");
    return;
  }
  const payload = {
    areaKey: areaKey(), mapId: currentMap, serverId: String(currentServer),
    x: pendingSpot.x, y: pendingSpot.y, charId: character.id,
    charName: character.name, color: character.color, updatedAt: serverTimestamp()
  };
  if (pendingSpot.mode === "edit") {
    await setDoc(doc(db, SPOTS_COLLECTION, pendingSpot.id), payload, { merge: true });
    selectedSpotId = pendingSpot.id;
  } else {
    const reference = await addDoc(collection(db, SPOTS_COLLECTION), { ...payload, createdAt: serverTimestamp() });
    selectedSpotId = reference.id;
  }
  pendingSpot = null;
  toast("Spot salvo");
}

async function deleteSpot(id) {
  if (!confirm("Excluir este spot?")) return;
  await deleteDoc(doc(db, SPOTS_COLLECTION, id));
  selectedSpotId = null;
  toast("Spot excluído");
}

function openCharacterDialog(character = null) {
  editingCharacterId = character?.id || null;
  els.charModalTitle.textContent = character ? "Editar Personagem" : "Adicionar Personagem";
  els.charNameInput.value = character?.name || "";
  els.charColorInput.value = character?.color || randomColor();
  els.characterDialog.showModal();
  setTimeout(() => els.charNameInput.focus(), 50);
}

async function saveCharacter() {
  const name = els.charNameInput.value.trim();
  const color = els.charColorInput.value;
  if (!name) {
    toast("Digite o nome do personagem");
    return;
  }
  if (editingCharacterId) {
    await setDoc(doc(db, CHARACTERS_COLLECTION, editingCharacterId), { name, color, updatedAt: serverTimestamp() }, { merge: true });
  } else {
    await addDoc(collection(db, CHARACTERS_COLLECTION), { name, color, createdAt: serverTimestamp() });
  }
  toast("Personagem salvo");
}

async function deleteCharacter(id) {
  if (!confirm("Excluir este personagem? Os spots existentes não serão removidos.")) return;
  await deleteDoc(doc(db, CHARACTERS_COLLECTION, id));
  toast("Personagem excluído");
}

async function clearCurrentArea() {
  const label = `${mapInfo().name} — Servidor ${currentServer}`;
  if (!confirm(`Limpar todos os spots de ${label}?`)) return;
  const spotsQuery = query(collection(db, SPOTS_COLLECTION), where("areaKey", "==", areaKey()));
  const snapshot = await getDocs(spotsQuery);
  const batch = writeBatch(db);
  snapshot.docs.forEach(document => batch.delete(document.ref));
  await batch.commit();
  selectedSpotId = null;
  toast("Área limpa");
}

async function exportLink() {
  const url = new URL(location.href);
  url.searchParams.set("map", currentMap);
  url.searchParams.set("server", currentServer);
  try {
    await navigator.clipboard.writeText(url.toString());
    toast("Link copiado");
  } catch {
    window.prompt("Copie o link:", url.toString());
  }
}

els.mapSelect.addEventListener("change", () => { currentMap = els.mapSelect.value; loadArea(); });
els.serverSelect.addEventListener("change", () => { currentServer = els.serverSelect.value; loadArea(); });
els.mapInner.addEventListener("click", openSpotDialogForNew);
els.spotsLayer.addEventListener("click", event => {
  const spot = event.target.closest(".spot");
  if (!spot) return;
  event.stopPropagation();
  selectedSpotId = spot.dataset.id;
  renderSpots();
});
els.saveSpotBtn.addEventListener("click", event => {
  event.preventDefault();
  saveSpot().then(() => els.spotDialog.close()).catch(error => { console.error(error); toast("Erro ao salvar spot"); });
});
els.addCharacterBtn.addEventListener("click", () => openCharacterDialog());
els.saveCharacterBtn.addEventListener("click", event => {
  event.preventDefault();
  saveCharacter().then(() => els.characterDialog.close()).catch(error => { console.error(error); toast("Erro ao salvar personagem"); });
});
els.charactersList.addEventListener("click", event => {
  const row = event.target.closest(".char-row");
  if (!row) return;
  const character = characters.find(item => item.id === row.dataset.id);
  if (event.target.classList.contains("edit-char")) openCharacterDialog(character);
  if (event.target.classList.contains("delete-char")) deleteCharacter(row.dataset.id);
});
els.characterSearch.addEventListener("input", renderCharacters);
els.showNamesToggle.addEventListener("change", renderSpots);
els.clearMapBtn.addEventListener("click", clearCurrentArea);
els.clearMapBtn2.addEventListener("click", clearCurrentArea);
els.exportBtn.addEventListener("click", exportLink);
els.shareBtn.addEventListener("click", exportLink);
els.centerMapBtn.addEventListener("click", () => {
  els.mapInner.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  toast("Mapa centralizado");
});

initSelectors();
subscribeCharacters();
