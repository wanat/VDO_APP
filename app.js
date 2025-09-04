(function(){
  const API = "https://plasomtv.com/api/get_series.php?series_id=";

  const $ = (q)=>document.querySelector(q);
  const sidInput = $("#sid");
  const btnLoad  = $("#btnLoad");
  const statusEl = $("#status");
  const posterEl = $("#poster");
  const titleEl  = $("#title");
  const descEl   = $("#desc");
  const epsEl    = $("#episodes");
  const video    = $("#player");
  const linkEx   = $("#ex");
  const btnPrev = document.querySelector("#btnPrev");
  const btnNext = document.querySelector("#btnNext");
  const chkAuto = document.querySelector("#chkAuto");


  let current = { id:null, title:"", episodes:[], index:-1 };

  function normId(x){
    const s = String(x||"").trim();
    if (!s) return "";
    if (/^\d+$/.test(s) && s.length < 4) return s.padStart(4,"0");
    return s;
  }

  function setStatus(msg, isErr=false){
    statusEl.innerHTML = isErr ? `<span class="err">${msg}</span>` : msg;
  }

  function saveLast(id){ try{ localStorage.setItem("last_series_id", id);}catch{} }
  function loadLast(){ try{ return localStorage.getItem("last_series_id")||"";}catch{ return "" } }

  async function fetchSeries(idRaw){
    const id = normId(idRaw);
    if (!id){ setStatus("กรุณาใส่ series_id", true); return; }
    setStatus("กำลังดึงข้อมูล…");
    btnLoad.disabled = true;

    try{
      const res = await fetch(API + encodeURIComponent(id), { method:"GET" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();

      if (!json || !json.success || !json.data){ throw new Error("รูปแบบข้อมูลไม่ถูกต้อง"); }

      const d = json.data;
      const episodes = Array.isArray(d.episodes)
        ? [...d.episodes].sort((a,b)=>(a.episode_number||0)-(b.episode_number||0))
        : [];

      posterEl.src = d.poster_url || "";
      posterEl.alt = d.title || "poster";
      titleEl.textContent = d.title || "(ไม่มีชื่อ)";
      descEl.textContent = d.description || "";

      renderEpisodes(episodes);

      current = { id, title:d.title || "", episodes, index: episodes.length ? 0 : -1 };
      saveLast(id);
      // หลังจาก saveLast(id); ให้เพิ่มบรรทัดนี้
try {
  const url = new URL(location.href);
  url.searchParams.set("series", id);
  history.replaceState(null, "", url.toString()); // ปรับ URL โดยไม่ reload
} catch {}


      if (episodes.length){
        playIndex(0, /*autoplay=*/false);
        setStatus(`โหลดสำเร็จ • พบ ${episodes.length} ตอน`);
      }else{
        video.removeAttribute("src");
        video.load();
        setStatus("ไม่พบตอนในชุดนี้", true);
      }
    }catch(err){
      console.error(err);
      setStatus("โหลดไม่สำเร็จ: " + (err.message||"ไม่ทราบสาเหตุ"), true);
    }finally{
      btnLoad.disabled = false;
    }
  }

  function renderEpisodes(list){
    epsEl.innerHTML = "";
    list.forEach((ep, i)=>{
      const row = document.createElement("div");
      row.className = "row";
      row.dataset.index = String(i);

      const epno = document.createElement("div");
      epno.className = "epno";
      epno.textContent = `EP ${ep.episode_number ?? i+1}`;

      const title = document.createElement("div");
      title.textContent = ep.title || `ตอนที่ ${ep.episode_number ?? (i+1)}`;

      row.appendChild(epno);
      row.appendChild(title);

      row.addEventListener("click", ()=> playIndex(i, true));
      epsEl.appendChild(row);
    });
    highlightPlaying();
  }

  function highlightPlaying(){
    [...epsEl.children].forEach((el, i)=>{
      if (i === current.index) el.classList.add("playing"); else el.classList.remove("playing");
    });
  }

  function playIndex(i, userInitiated){
    if (!current.episodes[i]) return;
    current.index = i;
    const url = current.episodes[i].video_url;
    if (!url){ setStatus("URL วิดีโอไม่ถูกต้อง", true); return; }

    const t = current.episodes[i].episode_number ?? (i+1);
    setStatus(`กำลังเล่น EP ${t}…`);
    highlightPlaying();

    video.src = url;
    video.load();
    if (userInitiated){
      video.play().catch(()=>{});
    }
  }

  function scrollCurrentIntoView(){
  const el = epsEl.children[current.index];
  if (el) el.scrollIntoView({ block:"nearest", behavior:"smooth" });
}

function playIndex(i, userInitiated){
  if (!current.episodes[i]) return;
  current.index = i;
  const url = current.episodes[i].video_url;
  if (!url){ setStatus("URL วิดีโอไม่ถูกต้อง", true); return; }

  const t = current.episodes[i].episode_number ?? (i+1);
  setStatus(`กำลังเล่น EP ${t}…`);
  highlightPlaying();

  video.src = url;
  video.load();
  if (userInitiated){
    video.play().catch(()=>{});
  }

  // เลื่อนรายการให้เห็นตอนที่กำลังเล่น
  scrollCurrentIntoView();

  // (ทางเลือก) เตรียมพรีโหลดเมตาดาต้อตอนถัดไปแบบเงียบ ๆ
  try {
    const next = current.episodes[i+1]?.video_url;
    if (next) {
      // เทคนิคเบา ๆ: สร้าง video ชั่วคราวพรีโหลด metadata (อาจไม่เสมอไปขึ้นกับ CORS)
      const tmp = document.createElement("video");
      tmp.preload = "metadata";
      tmp.src = next;
      // ไม่ต้อง append เข้า DOM ก็พอ เบราว์เซอร์ส่วนใหญ่จะดึงหัวไฟล์เพื่อ metadata
    }
  } catch {}
}


video.addEventListener("ended", ()=>{
  if (!current.episodes.length) return;
  if (chkAuto && chkAuto.checked) {
    goNext(false); // ไม่ต้องรีเฟรชหน้า
  } else {
    setStatus("จบตอนนี้แล้ว (ปิดเล่นอัตโนมัติ)");
  }
});


  function goNext(userInitiated){
  const next = current.index + 1;
  if (current.episodes[next]){
    playIndex(next, !!userInitiated);
    video.play().catch(()=>{});
  } else {
    setStatus("จบตอนสุดท้ายแล้ว");
  }
}

function goPrev(userInitiated){
  const prev = current.index - 1;
  if (current.episodes[prev]){
    playIndex(prev, !!userInitiated);
    video.play().catch(()=>{});
  } else {
    setStatus("นี่คือตอนแรกแล้ว");
  }
}


btnNext?.addEventListener("click", ()=> goNext(true));
btnPrev?.addEventListener("click", ()=> goPrev(true));

document.addEventListener("keydown", (e)=>{
  // ข้ามถ้าพิมพ์อยู่ในอินพุต
  if (document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (e.key === "ArrowRight") { e.preventDefault(); goNext(true); }
  if (e.key === "ArrowLeft")  { e.preventDefault(); goPrev(true); }
});


  btnLoad.addEventListener("click", ()=> fetchSeries(sidInput.value));
  sidInput.addEventListener("keydown", (e)=>{ if (e.key === "Enter") fetchSeries(sidInput.value); });
  linkEx.addEventListener("click", (e)=>{ e.preventDefault(); sidInput.value="0003"; fetchSeries("0003"); });

  // auto-load จาก query ?series=xxxx หรือจากค่าเดิม
  const urlParams = new URLSearchParams(location.search);
  const qid = urlParams.get("series");
  const last = loadLast();
  if (qid){ sidInput.value = qid; fetchSeries(qid); }
  else if (last){ sidInput.value = last; }
})();
