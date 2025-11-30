import { auth, db } from "./firebase.js";
import { ref, get, set, push, remove } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";
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

// 🔹 Controle da seção de notas
const secaoNotas = document.getElementById("secaoNotas");
const bimestreNotas = document.getElementById("bimestreNotas");
const mensagemNotas = document.getElementById("mensagemNotas");

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

// Guarda turmas do professor atual
let turmasDoProfessor = []; // ex: ["1º ano","3º ano"]

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

  // Preenche matéria
  materiaInput.value = u.materia || "";

  // Carrega turmas atribuídas ao professor
  // O admin salva como objeto classes: { "1º ano": true, "3º ano": true }
  turmasDoProfessor = [];
  if (u.classes) {
    turmasDoProfessor = Object.keys(u.classes).filter(k => u.classes[k]);
  }

  // Preenche os selects com as turmas do professor
  populateTurmasForTeacher(turmasDoProfessor);

  // Carrega conteúdos do professor
  carregarConteudos();
});

/**
 * Preenche os selects de série (notas/faltas) apenas com as turmas do professor.
 * Se o professor não tiver turmas (array vazio), deixa os selects vazios e mostra mensagem.
 */
function populateTurmasForTeacher(turmas) {
  // limpa selects
  serieSelect.innerHTML = '<option value="">Selecione a série</option>';
  serieFaltasSelect.innerHTML = '<option value="">Selecione a série</option>';
  // (se existir algum outro select de séries, preencha aqui também)

  if (!turmas || turmas.length === 0) {
    // opcional: você pode carregar todas as séries como fallback, se preferir
    // por enquanto, apenas mantemos a mensagem/placeholder
    return;
  }

  for (let t of turmas) {
    const opt1 = document.createElement("option");
    opt1.value = t;
    opt1.textContent = t;
    serieSelect.appendChild(opt1);

    const opt2 = document.createElement("option");
    opt2.value = t;
    opt2.textContent = t;
    serieFaltasSelect.appendChild(opt2);
  }

  // opcional: selecionar a primeira turma por padrão
  if (turmas.length > 0) {
    serieSelect.value = turmas[0];
    serieFaltasSelect.value = turmas[0];
    // dispara carregamento automático de tabela/faltas, se necessário
    carregarTabelaNotas();
    // dispara carregamento de lista de faltas
    const event = new Event('change');
    serieFaltasSelect.dispatchEvent(event);
  }
}

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

      const tdMedia = document.createElement("td");
      tdMedia.classList.add("td-media");
      tdMedia.textContent = "0";
      tr.appendChild(tdMedia);

      const tdFaltas = document.createElement("td");
      tdFaltas.classList.add("td-faltas");
      tdFaltas.textContent = "0";
      tr.appendChild(tdFaltas);

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
let conteudoEmEdicao = null;

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
    if (conteudoEmEdicao) {
      await set(ref(db, `conteudos/${user.uid}/${materia}/${conteudoEmEdicao}`), {
        conteudo,
        data: dataAula
      });
      alert("Conteúdo atualizado com sucesso!");
      conteudoEmEdicao = null;
      btnSalvarConteudo.textContent = "Salvar Conteúdo";
    } else {
      const novoRef = push(ref(db, `conteudos/${user.uid}/${materia}`));
      await set(novoRef, { conteudo, data: dataAula });
      alert("Conteúdo salvo com sucesso!");
    }

    conteudoInput.value = "";
    dataAulaInput.value = "";
    carregarConteudos();
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
    li.style.display = "flex";
    li.style.justifyContent = "space-between";
    li.style.alignItems = "center";
    li.style.gap = "10px";
    li.style.padding = "8px";
    li.style.marginBottom = "6px";
    li.style.borderRadius = "8px";
    li.style.backgroundColor = "#fff";
    li.style.boxShadow = "0 2px 4px rgba(0,0,0,0.08)";

    const texto = document.createElement("span");
    texto.textContent = `${dados[key].data} - ${dados[key].conteudo}`;
    texto.style.flex = "1";
    texto.style.wordBreak = "break-word";

    const btnBox = document.createElement("div");
    btnBox.style.display = "flex";
    btnBox.style.gap = "8px";
    btnBox.style.flexShrink = "0";

    const btnEditar = document.createElement("button");
    btnEditar.textContent = "✏️ Editar";
    btnEditar.style.backgroundColor = "#f8f008";
    btnEditar.style.border = "1px solid #ccc";
    btnEditar.style.borderRadius = "6px";
    btnEditar.style.padding = "4px 10px";
    btnEditar.style.cursor = "pointer";
    btnEditar.style.whiteSpace = "nowrap";

    btnEditar.addEventListener("click", () => {
      conteudoInput.value = dados[key].conteudo;
      dataAulaInput.value = dados[key].data;
      conteudoEmEdicao = key;
      btnSalvarConteudo.textContent = "Salvar Edição ✏️";
    });

    const btnExcluir = document.createElement("button");
    btnExcluir.textContent = "🗑️ Excluir";
    btnExcluir.style.backgroundColor = "#ffcccc";
    btnExcluir.style.border = "1px solid #ccc";
    btnExcluir.style.borderRadius = "6px";
    btnExcluir.style.padding = "4px 10px";
    btnExcluir.style.cursor = "pointer";
    btnExcluir.style.whiteSpace = "nowrap";

    btnExcluir.addEventListener("click", async () => {
      if (confirm("Tem certeza que deseja excluir este conteúdo?")) {
        await remove(ref(db, `conteudos/${user.uid}/${materia}/${key}`));
        alert("Conteúdo excluído com sucesso!");
        carregarConteudos();
      }
    });

    btnBox.appendChild(btnEditar);
    btnBox.appendChild(btnExcluir);
    li.appendChild(texto);
    li.appendChild(btnBox);
    listaConteudos.appendChild(li);
  }
}

// --------- LOGOUT ---------
document.querySelector("a[href='index.html']").addEventListener("click", async () => {
  await signOut(auth);
});
