import { auth, db } from "/js/firebase.js";
import { 
  onAuthStateChanged, 
  signOut 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { 
  ref, get, set, push, remove 
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";


// ------------------------------------------------------------------
// 🔒 PROTEÇÃO DE ROTA — SOMENTE PROFESSOR
// ------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  try {
    const snapUser = await get(ref(db, "users/" + user.uid));
    if (!snapUser.exists()) {
      window.location.href = "index.html";
      return;
    }

    const u = snapUser.val();
    if (u.role !== "teacher") {
      alert("Acesso negado");
      window.location.href = "index.html";
      return;
    }

    iniciarSistemaProfessor(u);

  } catch (err) {
    console.error("Erro de autenticação:", err);
    window.location.href = "index.html";
  }
});


// ------------------------------------------------------------------
// 🔹 SISTEMA DO PROFESSOR (SEU CÓDIGO ORIGINAL)
// ------------------------------------------------------------------
function iniciarSistemaProfessor(u) {

  // ELEMENTOS
  const serieSelect = document.getElementById("serieSelect");
  const materiaInput = document.getElementById("materia");
  const corpoTabelaNotas = document.getElementById("corpoTabelaNotas");
  const btnSalvarNotas = document.getElementById("btnSalvarNotas");

  const serieFaltasSelect = document.getElementById("serieFaltasSelect");
  const listaAlunosFaltas = document.getElementById("listaAlunosFaltas");
  const dataFaltaInput = document.getElementById("dataFalta");
  const btnSalvarFaltas = document.getElementById("btnSalvarFaltas");

  const conteudoInput = document.getElementById("conteudo");
  const dataAulaInput = document.getElementById("dataAula");
  const btnSalvarConteudo = document.getElementById("btnSalvarConteudo");
  const listaConteudos = document.getElementById("listaConteudos");
  const selectBimestre = document.getElementById("selectBimestre");

  const secaoNotas = document.getElementById("secaoNotas");
  const bimestreNotas = document.getElementById("bimestreNotas");
  const mensagemNotas = document.getElementById("mensagemNotas");

  let turmasDoProfessor = [];

  // ------------------ CONTROLE DE NOTAS ------------------
  bimestreNotas.addEventListener("change", () => {
    if (bimestreNotas.value) {
      secaoNotas.style.display = "block";
      mensagemNotas.style.display = "none";
    } else {
      secaoNotas.style.display = "none";
      mensagemNotas.style.display = "block";
    }
  });

  // ------------------ DADOS DO PROFESSOR ------------------
  materiaInput.value = u.materia || "";

  if (u.classes) {
    turmasDoProfessor = Object.keys(u.classes).filter(k => u.classes[k]);
  }

  populateTurmasForTeacher(turmasDoProfessor);
  carregarConteudos();


  // ------------------ TURMAS ------------------
  function populateTurmasForTeacher(turmas) {
    serieSelect.innerHTML = '<option value="">Selecione a série</option>';
    serieFaltasSelect.innerHTML = '<option value="">Selecione a série</option>';

    turmas.forEach(t => {
      serieSelect.add(new Option(t, t));
      serieFaltasSelect.add(new Option(t, t));
    });
  }


  // ------------------ NOTAS ------------------
  async function carregarTabelaNotas() {
    const serie = serieSelect.value;
    const bimestre = bimestreNotas.value;
    if (!serie || !bimestre) {
      corpoTabelaNotas.innerHTML = "";
      return;
    }

    const snapshot = await get(ref(db, "users"));
    const data = snapshot.val();
    corpoTabelaNotas.innerHTML = "";

    for (let uid in data) {
      const aluno = data[uid];
      if (aluno.role === "student" && aluno.serie === serie) {

        const tr = document.createElement("tr");
        tr.dataset.uid = uid;

        tr.innerHTML = `
          <td>${aluno.name}</td>
          <td><input type="number" data-campo="multidisciplinar" min="0" max="10"></td>
          <td><input type="number" data-campo="avaliacao" min="0" max="10"></td>
          <td><input type="number" data-campo="trabalho" min="0" max="10"></td>
          <td class="td-media">0</td>
          <td class="td-faltas">0</td>
        `;

        corpoTabelaNotas.appendChild(tr);
      }
    }

    carregarNotasExistentes();
  }

  serieSelect.addEventListener("change", carregarTabelaNotas);
  bimestreNotas.addEventListener("change", carregarTabelaNotas);

  corpoTabelaNotas.addEventListener("input", (e) => {
    if (e.target.tagName === "INPUT") {
      const tr = e.target.closest("tr");
      const inputs = tr.querySelectorAll("input");
      let soma = 0, count = 0;

      inputs.forEach(i => {
        if (!isNaN(i.value) && i.value !== "") {
          soma += Number(i.value);
          count++;
        }
      });

      tr.querySelector(".td-media").textContent = count ? (soma / count).toFixed(1) : "0";
    }
  });

  async function carregarNotasExistentes() {
    const materia = materiaInput.value;
    const bimestre = bimestreNotas.value;

    for (let tr of corpoTabelaNotas.querySelectorAll("tr")) {
      const uid = tr.dataset.uid;
      const snap = await get(ref(db, `grades/${uid}/${materia}/${bimestre}`));
      const g = snap.val();

      if (g) {
        tr.querySelector("[data-campo='multidisciplinar']").value = g.multidisciplinar ?? "";
        tr.querySelector("[data-campo='avaliacao']").value = g.avaliacao ?? "";
        tr.querySelector("[data-campo='trabalho']").value = g.trabalho ?? "";
        tr.querySelector(".td-media").textContent = g.media ?? "0";
        tr.querySelector(".td-faltas").textContent = g.faltas ?? "0";
      }
    }
  }

  btnSalvarNotas.addEventListener("click", async () => {
    const materia = materiaInput.value;
    const bimestre = bimestreNotas.value;

    for (let tr of corpoTabelaNotas.querySelectorAll("tr")) {
      const uid = tr.dataset.uid;
      const m = Number(tr.querySelector("[data-campo='multidisciplinar']").value) || 0;
      const a = Number(tr.querySelector("[data-campo='avaliacao']").value) || 0;
      const t = Number(tr.querySelector("[data-campo='trabalho']").value) || 0;
      const media = ((m + a + t) / 3).toFixed(1);
      const faltas = Number(tr.querySelector(".td-faltas").textContent) || 0;

      await set(ref(db, `grades/${uid}/${materia}/${bimestre}`), {
        multidisciplinar: m,
        avaliacao: a,
        trabalho: t,
        media,
        faltas,
        professor: auth.currentUser.email
      });
    }

    alert("Notas salvas com sucesso!");
  });


  // ------------------ FALTAS ------------------
  serieFaltasSelect.addEventListener("change", async () => {
    listaAlunosFaltas.innerHTML = "";
    const serie = serieFaltasSelect.value;
    if (!serie) return;

    const snap = await get(ref(db, "users"));
    const data = snap.val();

    for (let uid in data) {
      const a = data[uid];
      if (a.role === "student" && a.serie === serie) {
        listaAlunosFaltas.innerHTML += `
          <div>
            <input type="checkbox" value="${uid}"> ${a.name}
          </div>`;
      }
    }
  });

  btnSalvarFaltas.addEventListener("click", async () => {
    const materia = materiaInput.value;
    const dataFalta = dataFaltaInput.value;
    const bimestre = selectBimestre.value;

    const selecionados = [...listaAlunosFaltas.querySelectorAll("input:checked")]
      .map(cb => cb.value);

    for (let uid of selecionados) {
      const refGrade = ref(db, `grades/${uid}/${materia}/${bimestre}`);
      const snap = await get(refGrade);
      const atual = snap.val() || { faltas: 0 };

      await set(refGrade, {
        ...atual,
        faltas: atual.faltas + 1,
        professor: auth.currentUser.email
      });
    }

    alert("Faltas lançadas!");
  });


  // ------------------ CONTEÚDOS ------------------
  async function carregarConteudos() {
    const snap = await get(ref(db, `conteudos/${auth.currentUser.uid}/${materiaInput.value}`));
    const dados = snap.val();
    listaConteudos.innerHTML = "";

    if (!dados) {
      listaConteudos.innerHTML = "<li>Nenhum conteúdo lançado.</li>";
      return;
    }

    for (let k in dados) {
      listaConteudos.innerHTML += `<li>${dados[k].data} - ${dados[k].conteudo}</li>`;
    }
  }


  // ------------------ LOGOUT ------------------
  document.querySelector("a[href='index.html']").addEventListener("click", async () => {
    await signOut(auth);
  });
}
