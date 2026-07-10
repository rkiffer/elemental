import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, deleteDoc, onSnapshot,
  query, where, serverTimestamp, getDocs, writeBatch
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

// O Elemental usa coleções próprias para nunca misturar dados com o MegaHunt.
const CHARACTERS_COLLECTION = "elemental_characters";
const SPOTS_COLLECTION = "elemental_spots";
const PROJECT_ID = "elemental";
const LEGACY_CHARACTERS_COLLECTION = "characters";
const LEGACY_SPOTS_COLLECTION = "spots";

const MAPS = [
  { id: "Alkamar", name: "Alkamar", file: "assets/maps/Alkamar.png" },
  { id: "Ubaid", name: "Ubaid", file: "assets/maps/Ubaid.png" },
  { id: "Debenter", name: "Debenter", file: "assets/maps/Debenter.png" },
  { id: "Uruk", name: "Uruk", file: "assets/maps/Uruk.png" },
  { id: "Nars", name: "Nars", file: "assets/maps/Nars.png" }
];
const SERVERS = [1,2,3,4,5,6,7,8,9,10,11,12,14,15,16,17,18];
const $ = id => document.getElementById(id);
const els = {
  mapSelect: $("mapSelect"), serverSelect: $("serverSelect"), mapImage: $("mapImage"),
  mapInner: $("mapInner"), spotsLayer: $("spotsLayer"), currentMapName: $("currentMapName"),
  currentServerName: $("currentServerName"), charactersList: $("charactersList"),
  characterSearch: $("characterSearch"), spotsCount: $("spotsCount"), charsCount: $("charsCount"),
  lastUpdate: $("lastUpdate"), showNamesToggle: $("showNamesToggle"), spotDialog: $("spotDialog"),
  spotCharacterSelect: $("spotCharacterSelect"), spotCharacterSearch: $("spotCharacterSearch"),
  spotCharacterResults: $("spotCharacterResults"), saveSpotBtn: $("saveSpotBtn"),
  characterDialog: $("characterDialog"), charNameInput: $("charNameInput"),
  charColorInput: $("charColorInput"), saveCharacterBtn: $("saveCharacterBtn"),
  charModalTitle: $("charModalTitle"), addCharacterBtn: $("addCharacterBtn"),
  spotInspector: $("spotInspector"), clearMapBtn: $("clearMapBtn"),
  clearMapBtn2: $("clearMapBtn2"), exportBtn: $("exportBtn"), shareBtn: $("shareBtn"),
  centerMapBtn: $("centerMapBtn"), globalSearchBtn: $("globalSearchBtn"),
  globalSearchDialog: $("globalSearchDialog"), globalSearchInput: $("globalSearchInput"),
  globalSearchResults: $("globalSearchResults")
};

const params = new URLSearchParams(location.search);
let currentMap = params.get("map") || "Alkamar";
let currentServer = params.get("server") || "1";
let characters = [];
let spots = [];
let allSpots = [];
let pendingSpot = null;
let selectedSpotId = null;
let editingCharacterId = null;
let unsubChars = null;
let unsubSpots = null;
let unsubAllSpots = null;

function toast(message, duration = 2600) {
  const element = $("toast");
  element.textContent = message;
  element.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove("show"), duration);
}
function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#039;",'"':"&quot;"})[c]);
}
function normalize(value = "") { return String(value).trim().toLowerCase(); }
function randomColor() {
  const colors=["#31d978","#64f0a0","#e2bd55","#55d8d0","#6a9dff","#b477ff","#ff718b","#ff9d55"];
  return colors[Math.floor(Math.random()*colors.length)];
}
function mapInfo(){ return MAPS.find(m=>m.id===currentMap)||MAPS[0]; }
function areaKey(){ return `${currentMap}__S${currentServer}`; }
function updateUrl(){
  const url=new URL(location.href); url.searchParams.set("map",currentMap); url.searchParams.set("server",currentServer);
  history.replaceState(null,"",url.toString());
}
function nowLabel(){ return new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}); }
function friendlyFirebaseError(error){
  const code=error?.code||"";
  if(code.includes("permission-denied")) return "Firebase bloqueou a gravação. Verifique as regras do Firestore.";
  if(code.includes("unavailable")) return "Firebase indisponível. Verifique sua internet e tente novamente.";
  if(code.includes("failed-precondition")) return "O Firebase precisa de um índice. Abra o console para ver o link de criação.";
  return error?.message ? `Erro: ${error.message}` : "Não foi possível concluir a operação.";
}


async function commitOperationsInChunks(operations, chunkSize = 400) {
  for (let start = 0; start < operations.length; start += chunkSize) {
    const batch = writeBatch(db);
    for (const operation of operations.slice(start, start + chunkSize)) {
      if (operation.type === "set") batch.set(operation.ref, operation.data, { merge: true });
      if (operation.type === "delete") batch.delete(operation.ref);
    }
    await batch.commit();
  }
}

async function migrateLegacyElementalData() {
  const migrationKey = "elementalCollectionsMigrationV1";
  if (localStorage.getItem(migrationKey) === "done") return;

  try {
    const legacyCharactersQuery = query(
      collection(db, LEGACY_CHARACTERS_COLLECTION),
      where("projectId", "==", PROJECT_ID)
    );
    const legacySpotsQuery = query(
      collection(db, LEGACY_SPOTS_COLLECTION),
      where("projectId", "==", PROJECT_ID)
    );

    const [legacyCharacters, legacySpots] = await Promise.all([
      getDocs(legacyCharactersQuery),
      getDocs(legacySpotsQuery)
    ]);

    const operations = [];

    legacyCharacters.docs.forEach(sourceDoc => {
      operations.push({
        type: "set",
        ref: doc(db, CHARACTERS_COLLECTION, sourceDoc.id),
        data: sourceDoc.data()
      });
      operations.push({ type: "delete", ref: sourceDoc.ref });
    });

    legacySpots.docs.forEach(sourceDoc => {
      operations.push({
        type: "set",
        ref: doc(db, SPOTS_COLLECTION, sourceDoc.id),
        data: sourceDoc.data()
      });
      operations.push({ type: "delete", ref: sourceDoc.ref });
    });

    if (operations.length) {
      await commitOperationsInChunks(operations);
      toast("Dados do Elemental separados do MegaHunt com sucesso", 4200);
    }

    localStorage.setItem(migrationKey, "done");
  } catch (error) {
    console.error("Migração das coleções Elemental:", error);
    toast("Não foi possível separar os dados antigos. Verifique as regras do Firebase.", 6000);
  }
}

function initSelectors(){
  els.mapSelect.innerHTML=MAPS.map(m=>`<option value="${m.id}">${m.name}</option>`).join("");
  els.serverSelect.innerHTML=SERVERS.map(s=>`<option value="${s}">Servidor ${s}</option>`).join("");
  if(!MAPS.some(m=>m.id===currentMap)) currentMap=MAPS[0].id;
  if(!SERVERS.includes(Number(currentServer))) currentServer=String(SERVERS[0]);
  els.mapSelect.value=currentMap; els.serverSelect.value=currentServer; loadArea();
}
function loadArea(){
  const map=mapInfo();
  els.currentMapName.textContent=map.name; els.currentServerName.textContent=`Servidor ${currentServer}`;
  els.mapSelect.value=currentMap; els.serverSelect.value=currentServer;
  els.mapImage.src=map.file; els.mapImage.alt=`${map.name} - Servidor ${currentServer}`;
  selectedSpotId=null; updateUrl(); subscribeSpots();
}

function subscribeCharacters(){
  if(unsubChars) unsubChars();
  const q=query(collection(db,CHARACTERS_COLLECTION),where("projectId","==",PROJECT_ID));
  unsubChars=onSnapshot(q,snapshot=>{
    characters=snapshot.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>String(a.name).localeCompare(String(b.name)));
    renderCharacters(); renderCharacterOptions(); renderStats();
  },error=>{ console.error(error); toast(friendlyFirebaseError(error),5000); });
}
function subscribeSpots(){
  if(unsubSpots) unsubSpots();
  const q=query(collection(db,SPOTS_COLLECTION),where("areaKey","==",areaKey()));
  unsubSpots=onSnapshot(q,snapshot=>{
    spots=snapshot.docs.map(d=>({id:d.id,...d.data()})).filter(s=>s.projectId===PROJECT_ID);
    renderSpots(); renderStats();
  },error=>{ console.error(error); toast(friendlyFirebaseError(error),5000); });
}
function subscribeAllSpots(){
  if(unsubAllSpots) unsubAllSpots();
  unsubAllSpots=onSnapshot(collection(db,SPOTS_COLLECTION),snapshot=>{
    allSpots=snapshot.docs.map(d=>({id:d.id,...d.data()})).filter(s=>s.projectId===PROJECT_ID);
    if(els.globalSearchDialog?.open) renderGlobalSearch();
  },error=>console.error("Busca global:",error));
}

function renderCharacters(){
  const term=normalize(els.characterSearch.value);
  const filtered=characters.filter(c=>normalize(c.name).includes(term));
  els.charactersList.innerHTML=filtered.map(c=>`
    <div class="char-row" data-id="${c.id}">
      <span class="dot" style="color:${c.color};background:${c.color}"></span>
      <span class="char-name" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</span>
      <button class="text-btn edit-char" type="button">Editar</button>
      <button class="x-btn delete-char" type="button" aria-label="Excluir">×</button>
    </div>`).join("")||'<p class="muted empty-state">Nenhum personagem adicionado.</p>';
}
function renderCharacterOptions(){
  if(!els.spotCharacterSelect.value && characters[0]) els.spotCharacterSelect.value=characters[0].id;
  renderSpotCharacterResults();
}
function renderSpotCharacterResults(){
  if(!els.spotCharacterResults) return;
  const term=normalize(els.spotCharacterSearch?.value||"");
  const selectedId=els.spotCharacterSelect.value;
  const filtered=characters.filter(c=>normalize(c.name).includes(term));
  if(!filtered.length){
    els.spotCharacterResults.innerHTML='<p class="spot-picker-empty">Nenhum personagem encontrado.</p>';
    return;
  }
  els.spotCharacterResults.innerHTML=filtered.map(c=>`<button class="spot-character-option${c.id===selectedId?" selected":""}" type="button" role="option" aria-selected="${c.id===selectedId}" data-id="${c.id}">
    <span class="dot" style="color:${c.color};background:${c.color}"></span>
    <span class="spot-option-name">${escapeHtml(c.name)}</span>
    <span class="spot-option-check">✓</span>
  </button>`).join("");
}
function renderStats(){
  els.spotsCount.textContent=`${spots.length} / 500`; els.charsCount.textContent=characters.length; els.lastUpdate.textContent=nowLabel();
}
function renderSpots(){
  els.spotsLayer.innerHTML=spots.map(spot=>{
    const color=spot.color||"#31d978"; const hidden=els.showNamesToggle.checked?"":" hide-name"; const selected=selectedSpotId===spot.id?" selected":"";
    return `<div class="spot${hidden}${selected}" data-id="${spot.id}" style="left:${spot.x}%;top:${spot.y}%;color:${color}">
      <span class="spot-dot" style="background:${color}"></span><span class="spot-label">${escapeHtml(spot.charName||"Sem nome")}</span></div>`;
  }).join("");
  renderInspector();
}
function renderInspector(){
  const spot=spots.find(s=>s.id===selectedSpotId);
  if(!spot){ els.spotInspector.innerHTML='<h3>Spot Selecionado</h3><p class="muted">Clique em um spot para editar ou excluir.</p>'; return; }
  els.spotInspector.innerHTML=`<h3>Spot Selecionado</h3>
    <div class="inspector-row"><span>Mapa</span><strong>${escapeHtml(mapInfo().name)}</strong></div>
    <div class="inspector-row"><span>Servidor</span><strong>${escapeHtml(currentServer)}</strong></div>
    <div class="inspector-row"><span>Char</span><strong>${escapeHtml(spot.charName||"--")}</strong></div>
    <div class="inspector-row"><span>X / Y</span><strong>${Number(spot.x).toFixed(1)}% / ${Number(spot.y).toFixed(1)}%</strong></div>
    <button class="wide green-outline" id="editSpotBtn" type="button">Editar Spot</button>
    <button class="wide danger-outline" id="deleteSpotBtn" type="button">Excluir Spot</button>`;
  $("editSpotBtn").onclick=()=>openSpotDialogForEdit(spot); $("deleteSpotBtn").onclick=()=>deleteSpot(spot.id);
}
function pointToPercent(event){ const r=els.mapInner.getBoundingClientRect(); return {x:Math.max(0,Math.min(100,((event.clientX-r.left)/r.width)*100)),y:Math.max(0,Math.min(100,((event.clientY-r.top)/r.height)*100))}; }
function clickInsideMap(event){ const r=els.mapInner.getBoundingClientRect(); return event.clientX>=r.left&&event.clientX<=r.right&&event.clientY>=r.top&&event.clientY<=r.bottom; }
function openSpotDialogForNew(event){
  if(event.target.closest(".spot")||!clickInsideMap(event)) return;
  if(characters.length===0){toast("Adicione um personagem primeiro");return;}
  pendingSpot={...pointToPercent(event),mode:"new"};
  els.spotCharacterSelect.value=characters[0].id;
  els.spotCharacterSearch.value="";
  $("modalTitle").textContent="Selecionar personagem para o spot";
  renderSpotCharacterResults();
  els.spotDialog.showModal();
  setTimeout(()=>els.spotCharacterSearch.focus(),60);
}
function openSpotDialogForEdit(spot){
  pendingSpot={...spot,mode:"edit"};
  els.spotCharacterSelect.value=spot.charId||characters[0]?.id||"";
  els.spotCharacterSearch.value="";
  $("modalTitle").textContent="Alterar personagem do spot";
  renderSpotCharacterResults();
  els.spotDialog.showModal();
  setTimeout(()=>els.spotCharacterSearch.focus(),60);
}
async function saveSpot(){
  if(!pendingSpot) return;
  const character=characters.find(c=>c.id===els.spotCharacterSelect.value); if(!character) throw new Error("Selecione um personagem");
  const payload={projectId:PROJECT_ID,areaKey:areaKey(),mapId:currentMap,serverId:String(currentServer),x:pendingSpot.x,y:pendingSpot.y,charId:character.id,charName:character.name,color:character.color,updatedAt:serverTimestamp()};
  if(pendingSpot.mode==="edit"){await setDoc(doc(db,SPOTS_COLLECTION,pendingSpot.id),payload,{merge:true});selectedSpotId=pendingSpot.id;}
  else{const ref=await addDoc(collection(db,SPOTS_COLLECTION),{...payload,createdAt:serverTimestamp()});selectedSpotId=ref.id;}
  pendingSpot=null; toast("Spot salvo");
}
async function deleteSpot(id){ if(!confirm("Excluir este spot?"))return; try{await deleteDoc(doc(db,SPOTS_COLLECTION,id));selectedSpotId=null;toast("Spot excluído");}catch(e){console.error(e);toast(friendlyFirebaseError(e),5000);} }
function openCharacterDialog(character=null){
  editingCharacterId=character?.id||null; els.charModalTitle.textContent=character?"Editar Personagem":"Adicionar Personagem";
  els.charNameInput.value=character?.name||""; els.charColorInput.value=character?.color||randomColor(); els.characterDialog.showModal(); setTimeout(()=>els.charNameInput.focus(),50);
}
async function saveCharacter(){
  const name=els.charNameInput.value.trim(),color=els.charColorInput.value;
  if(!name) throw new Error("Digite o nome do personagem");
  const duplicate=characters.some(c=>normalize(c.name)===normalize(name)&&c.id!==editingCharacterId);
  if(duplicate) throw new Error("Já existe um personagem com esse nome");
  if(editingCharacterId) await setDoc(doc(db,CHARACTERS_COLLECTION,editingCharacterId),{projectId:PROJECT_ID,name,color,updatedAt:serverTimestamp()},{merge:true});
  else await addDoc(collection(db,CHARACTERS_COLLECTION),{projectId:PROJECT_ID,name,color,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  toast("Personagem salvo");
}
async function deleteCharacter(id){ if(!confirm("Excluir este personagem? Os spots existentes não serão removidos."))return; try{await deleteDoc(doc(db,CHARACTERS_COLLECTION,id));toast("Personagem excluído");}catch(e){console.error(e);toast(friendlyFirebaseError(e),5000);} }
async function clearCurrentArea(){
  const label=`${mapInfo().name} — Servidor ${currentServer}`; if(!confirm(`Limpar todos os spots de ${label}?`))return;
  try{const q=query(collection(db,SPOTS_COLLECTION),where("areaKey","==",areaKey()));const snap=await getDocs(q);const batch=writeBatch(db);snap.docs.filter(d=>d.data().projectId===PROJECT_ID).forEach(d=>batch.delete(d.ref));await batch.commit();selectedSpotId=null;toast("Área limpa");}
  catch(e){console.error(e);toast(friendlyFirebaseError(e),5000);}
}
async function exportLink(){
  const url=new URL(location.href);url.searchParams.set("map",currentMap);url.searchParams.set("server",currentServer);
  try{await navigator.clipboard.writeText(url.toString());toast("Link copiado");}catch{window.prompt("Copie o link:",url.toString());}
}

function renderGlobalSearch(){
  const term=normalize(els.globalSearchInput.value);
  if(!term){els.globalSearchResults.innerHTML='<p class="muted">Digite o nome do char ou o dono entre parênteses, por exemplo: <b>RNK</b>.</p>';return;}
  const characterMap=new Map(characters.map(c=>[c.id,c]));
  const results=allSpots.filter(s=>{
    const currentName=s.charName||characterMap.get(s.charId)?.name||"";
    return normalize(currentName).includes(term);
  }).sort((a,b)=>String(a.mapId).localeCompare(String(b.mapId))||Number(a.serverId)-Number(b.serverId)||String(a.charName).localeCompare(String(b.charName)));
  if(!results.length){els.globalSearchResults.innerHTML=`<p class="muted">Nenhum spot encontrado para <b>${escapeHtml(els.globalSearchInput.value.trim())}</b>.</p>`;return;}
  const grouped={};
  for(const r of results){(grouped[r.mapId]??=[]).push(r);}
  els.globalSearchResults.innerHTML=`<div class="search-summary">${results.length} spot${results.length>1?"s":""} encontrado${results.length>1?"s":""}</div>`+
    Object.entries(grouped).map(([map,items])=>`<section class="search-group"><h3>${escapeHtml(map)}</h3>${items.map(r=>`<button class="search-result" type="button" data-map="${escapeHtml(r.mapId)}" data-server="${escapeHtml(r.serverId)}" data-spot="${escapeHtml(r.id)}"><span>Servidor ${escapeHtml(r.serverId)}</span><strong>${escapeHtml(r.charName||"Sem nome")}</strong><em>Ver no mapa →</em></button>`).join("")}</section>`).join("");
}
function openGlobalSearch(){ els.globalSearchDialog.showModal(); els.globalSearchInput.value=""; renderGlobalSearch(); setTimeout(()=>els.globalSearchInput.focus(),60); }
function goToSearchResult(button){
  currentMap=button.dataset.map;currentServer=button.dataset.server;selectedSpotId=button.dataset.spot;els.globalSearchDialog.close();loadArea();
  const wait=setInterval(()=>{if(spots.some(s=>s.id===selectedSpotId)){clearInterval(wait);renderSpots();setTimeout(()=>document.querySelector(`.spot[data-id="${selectedSpotId}"]`)?.scrollIntoView({behavior:"smooth",block:"center",inline:"center"}),100);}},100);
  setTimeout(()=>clearInterval(wait),4000);
}

els.mapSelect.addEventListener("change",()=>{currentMap=els.mapSelect.value;loadArea();});
els.serverSelect.addEventListener("change",()=>{currentServer=els.serverSelect.value;loadArea();});
els.mapInner.addEventListener("click",openSpotDialogForNew);
els.spotsLayer.addEventListener("click",event=>{const spot=event.target.closest(".spot");if(!spot)return;event.stopPropagation();selectedSpotId=spot.dataset.id;renderSpots();});

els.spotCharacterSearch.addEventListener("input",renderSpotCharacterResults);
els.spotCharacterResults.addEventListener("click",event=>{
  const option=event.target.closest(".spot-character-option");
  if(!option)return;
  els.spotCharacterSelect.value=option.dataset.id;
  renderSpotCharacterResults();
});
els.spotCharacterSearch.addEventListener("keydown",event=>{
  if(event.key!=="Enter")return;
  event.preventDefault();
  const first=els.spotCharacterResults.querySelector(".spot-character-option");
  if(first){els.spotCharacterSelect.value=first.dataset.id;renderSpotCharacterResults();}
});
els.saveSpotBtn.addEventListener("click",async event=>{event.preventDefault();try{await saveSpot();els.spotDialog.close();}catch(e){console.error(e);toast(friendlyFirebaseError(e),5000);}});
els.addCharacterBtn.addEventListener("click",()=>openCharacterDialog());
els.saveCharacterBtn.addEventListener("click",async event=>{event.preventDefault();try{await saveCharacter();els.characterDialog.close();}catch(e){console.error(e);toast(friendlyFirebaseError(e),5000);}});
els.charactersList.addEventListener("click",event=>{const row=event.target.closest(".char-row");if(!row)return;const c=characters.find(i=>i.id===row.dataset.id);if(event.target.classList.contains("edit-char"))openCharacterDialog(c);if(event.target.classList.contains("delete-char"))deleteCharacter(row.dataset.id);});
els.characterSearch.addEventListener("input",renderCharacters); els.showNamesToggle.addEventListener("change",renderSpots);
els.clearMapBtn.addEventListener("click",clearCurrentArea);els.clearMapBtn2.addEventListener("click",clearCurrentArea);els.exportBtn.addEventListener("click",exportLink);els.shareBtn.addEventListener("click",exportLink);
els.centerMapBtn.addEventListener("click",()=>{els.mapInner.scrollIntoView({behavior:"smooth",block:"center",inline:"center"});toast("Mapa centralizado");});
els.globalSearchBtn.addEventListener("click",openGlobalSearch);els.globalSearchInput.addEventListener("input",renderGlobalSearch);
els.globalSearchResults.addEventListener("click",event=>{const button=event.target.closest(".search-result");if(button)goToSearchResult(button);});

async function startApp() {
  await migrateLegacyElementalData();
  initSelectors();
  subscribeCharacters();
  subscribeAllSpots();
}

startApp();
