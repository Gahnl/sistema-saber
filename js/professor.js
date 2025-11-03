import { auth, db } from "./firebase.js";
import { ref, get, set, push } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

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

// 🔹 Novos elementos para controle visual da seção de notas
const secaoNotas = document.getElementById("secaoNotas");
const bimestreNotas = document.getElementById("bimestreNotas");
const mensagemNotas = document.getElementById("mensagemNotas");

// 🔹 Exibe ou esconde a tabela de notas conforme o bimestre
bimestreNotas.addEventListener("change", () => {
  if (bimestreNotas.value) {
    secaoNotas.style.display = "block";
    mensagemNotas.style.display = "none";
    secaoNotas.style.opacity = "0";
    setTimeout(() => { secaoNotas.style.opacity = "1"; }, 150);
  } else {
    secaoNotas.style.display = "none";
    mensagemNotas.style.display = "block";
  }
});

// AUTENTICAÇÃO
auth.onAuthStateChanged(async (user) => {
  if (!user) { window.location.href = "index.html"; return; }

  const snapUser = await get(ref(db, "users/" + user.uid));
  const u = snapUser.val();
  if (!u || u.role !== "teacher") {
    alert("Acesso negado");
    window.location.href = "index.html";
    return;
  }

  materiaInput.value = u.materia;
  carregarConteudos();
});

// --------- LANÇAMENTO DE NOTAS ---------
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
    const u = data[uid];
    if (u.role === "student" && u.serie === serie) {
      const tr = document.createElement("tr");
      tr.dataset.uid = uid;

      const tdNome = document.createElement("td");
      tdNome.textContent = u.name;
      tr.appendChild(tdNome);

      // Campos de nota
      const campos = ["multidisciplinar", "avaliacao", "trabalho"];
      for (let campo of campos) {
        const td = document.createElement("td");
        const input = document.createElement("input");
        input.type = "number";
        input.min = 0;
        input.max = 10;
        input.step = 0.1;
        input.dataset.campo = campo;
        input.style.width = "80px";
        td.appendChild(input);
        tr.appendChild(td);
      }

      // Média Final
      const tdMedia = document.createElement("td");
      tdMedia.classList.add("td-media");
      tdMedia.textContent = "0";
      tr.appendChild(tdMedia);

      // Faltas
      const tdFaltas = document.createElement("td");
      tdFaltas.classList.add("td-faltas");
      tdFaltas.textContent = "0";
      tr.appendChild(tdFaltas);

      corpoTabelaNotas.appendChild(tr);
    }
  }

  carregarNotasExistentes();
}

// Atualiza tabela ao mudar série ou bimestre
serieSelect.addEventListener("change", carregarTabelaNotas);
bimestreNotas.addEventListener("change", carregarTabelaNotas);

// Calcular média automaticamente ao digitar
corpoTabelaNotas.addEventListener("input", (e) => {
  if (e.target.tagName === "INPUT") {
    const tr = e.target.closest("tr");
    const notas = tr.querySelectorAll("input[type='number']");
    let soma = 0, count = 0;

    notas.forEach(input => {
      const val = parseFloat(input.value);
      if (!isNaN(val)) {
        soma += val;
        count++;
      }
    });

    const media = count ? (soma / count).toFixed(1) : "0";
    tr.querySelector(".td-media").textContent = media;
  }
});

async function carregarNotasExistentes() {
  const alunos = corpoTabelaNotas.querySelectorAll("tr");
  const materia = materiaInput.value;
  const bimestre = bimestreNotas.value;

  for (let tr of alunos) {
    const uid = tr.dataset.uid;
    const gradesSnap = await get(ref(db, `grades/${uid}/${materia}/${bimestre}`));
    const grades = gradesSnap.val();

    if (grades) {
      tr.querySelector(`input[data-campo='multidisciplinar']`).value = grades.multidisciplinar ?? "";
      tr.querySelector(`input[data-campo='avaliacao']`).value = grades.avaliacao ?? "";
      tr.querySelector(`input[data-campo='trabalho']`).value = grades.trabalho ?? "";
      tr.querySelector(".td-media").textContent = grades.media ?? "0";
      tr.querySelector(".td-faltas").textContent = grades.faltas ?? "0";
    }
  }
}

btnSalvarNotas.addEventListener("click", async () => {
  const user = auth.currentUser;
  const materia = materiaInput.value;
  const bimestre = bimestreNotas.value;
  const alunos = corpoTabelaNotas.querySelectorAll("tr");

  if (!bimestre) {
    alert("Selecione o bimestre antes de salvar!");
    return;
  }

  try {
    for (let tr of alunos) {
      const uid = tr.dataset.uid;
      const multidisciplinar = Number(tr.querySelector(`input[data-campo='multidisciplinar']`).value) || 0;
      const avaliacao = Number(tr.querySelector(`input[data-campo='avaliacao']`).value) || 0;
      const trabalho = Number(tr.querySelector(`input[data-campo='trabalho']`).value) || 0;
      const media = ((multidisciplinar + avaliacao + trabalho) / 3).toFixed(1);
      const faltas = Number(tr.querySelector(".td-faltas").textContent) || 0;

      await set(ref(db, `grades/${uid}/${materia}/${bimestre}`), {
        multidisciplinar,
        avaliacao,
        trabalho,
        media,
        faltas,
        professor: user.email
      });
    }

    alert("Notas salvas com sucesso!");
  } catch (err) {
    alert("Erro ao salvar notas: " + err.message);
  }
});

// --------- LANÇAMENTO DE FALTAS ---------
serieFaltasSelect.addEventListener("change", async () => {
  const serie = serieFaltasSelect.value;
  listaAlunosFaltas.innerHTML = "";
  if (!serie) return;

  const snapshot = await get(ref(db, "users"));
  const data = snapshot.val();

  for (let uid in data) {
    const u = data[uid];
    if (u.role === "student" && u.serie === serie) {
      const div = document.createElement("div");
      div.style.marginBottom = "5px";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.value = uid;
      checkbox.id = "falta_" + uid;

      const label = document.createElement("label");
      label.htmlFor = "falta_" + uid;
      label.textContent = u.name;

      div.appendChild(checkbox);
      div.appendChild(label);
      listaAlunosFaltas.appendChild(div);
    }
  }
});

btnSalvarFaltas.addEventListener("click", async () => {
  const user = auth.currentUser;
  const materia = materiaInput.value;
  const dataFalta = dataFaltaInput.value;
  const bimestre = selectBimestre.value;

  if (!serieFaltasSelect.value || !dataFalta || !bimestre) {
    alert("Selecione a série, a data e o bimestre!");
    return;
  }

  const checkboxes = listaAlunosFaltas.querySelectorAll("input[type='checkbox']");
  const alunosFaltantes = [];
  checkboxes.forEach(cb => { if (cb.checked) alunosFaltantes.push(cb.value); });

  if (alunosFaltantes.length === 0) {
    alert("Nenhum aluno selecionado!");
    return;
  }

  try {
    for (let uid of alunosFaltantes) {
      const novoRef = push(ref(db, `faltas/${uid}/${materia}`));
      await set(novoRef, {
        data: dataFalta,
        professor: user.email,
        faltas: 1,
        bimestre: Number(bimestre)
      });

      const gradeRef = ref(db, `grades/${uid}/${materia}/${bimestre}`);
      const snap = await get(gradeRef);
      const atual = snap.val();

      const faltasAtuais = atual && atual.faltas ? atual.faltas : 0;
      await set(gradeRef, {
        ...atual,
        faltas: faltasAtuais + 1,
        professor: user.email
      });
    }

    dataFaltaInput.value = "";
    selectBimestre.value = "";
    checkboxes.forEach(cb => cb.checked = false);
    await carregarNotasExistentes();

    alert(`Faltas lançadas e atualizadas no ${bimestre}º bimestre!`);
  } catch (err) {
    alert("Erro ao lançar faltas: " + err.message);
  }
});

// --------- CONTEÚDOS ---------
btnSalvarConteudo.addEventListener("click", async () => {
  const user = auth.currentUser;
  const materia = materiaInput.value;
  const conteudo = conteudoInput.value.trim();
  const dataAula = dataAulaInput.value;

  if (!conteudo || !dataAula) {
    alert("Preencha o conteúdo e a data!");
    return;
  }

  try {
    const novoRef = push(ref(db, `conteudos/${user.uid}/${materia}`));
    await set(novoRef, { conteudo, data: dataAula });
    conteudoInput.value = "";
    dataAulaInput.value = "";
    carregarConteudos();
    alert("Conteúdo salvo com sucesso!");
  } catch (err) {
    alert("Erro ao salvar conteúdo: " + err.message);
  }
});

async function carregarConteudos() {
  const user = auth.currentUser;
  const materia = materiaInput.value;
  const snap = await get(ref(db, `conteudos/${user.uid}/${materia}`));
  const dados = snap.val();

  listaConteudos.innerHTML = "";
  if (!dados) {
    listaConteudos.innerHTML = "<li>Nenhum conteúdo lançado ainda.</li>";
    return;
  }

  for (let key in dados) {
    const li = document.createElement("li");
    li.textContent = `${dados[key].data} - ${dados[key].conteudo}`;
    listaConteudos.appendChild(li);
  }
}

// --------- LOGOUT ---------
document.querySelector("a[href='index.html']").addEventListener("click", async () => {
  await signOut(auth);
});
