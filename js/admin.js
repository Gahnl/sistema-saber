// js/admin.js
import { auth, db } from "./firebase.js";
import { ref, set, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";


// ------------------------------------------------------------------
// MULTI SELECT DE TURMAS (COMPATÍVEL COM SEU HTML ATUAL)
// ------------------------------------------------------------------
const field = document.getElementById("multiSelectField");
const list = document.getElementById("multiSelectList");

// abre/fecha o menu
field.addEventListener("click", () => {
  list.style.display = list.style.display === "block" ? "none" : "block";
});

// fecha ao clicar fora
document.addEventListener("click", (e) => {
  if (!field.contains(e.target) && !list.contains(e.target)) {
    list.style.display = "none";
  }
});

// coleta seleção atualizada
window.getTurmasSelecionadas = () => {
  return [...list.querySelectorAll("input:checked")].map(chk => chk.value);
};

// muda texto quando o usuário seleciona ou desmarca
list.addEventListener("change", () => {
  const selecionadas = window.getTurmasSelecionadas();
  field.textContent = selecionadas.length
    ? selecionadas.join(", ")
    : "Selecione as turmas";
});




// ------------------------------------------------------------------
// CADASTRAR PROFESSOR
// ------------------------------------------------------------------
document.getElementById("btnCreateProf").addEventListener("click", async () => {

  const name = document.getElementById("profName").value.trim();
  const email = document.getElementById("profEmail").value.trim();
  const senha = document.getElementById("profSenha").value.trim();
  const materia = document.getElementById("profMateria").value;

  const turmasSelecionadas = window.getTurmasSelecionadas();

  if (!name || !email || !senha || !materia || turmasSelecionadas.length === 0) {
    alert("Preencha todos os campos e selecione ao menos uma turma!");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
    const userId = userCredential.user.uid;

    await set(ref(db, "users/" + userId), {
      name,
      email,
      role: "teacher",
      materia,
      precisaTrocarSenha: true,
      classes: turmasSelecionadas.reduce((acc, turma) => {
        acc[turma] = true;
        return acc;
      }, {})
    });

    alert("Professor cadastrado com sucesso!");

    // limpar campos
    document.getElementById("profName").value = "";
    document.getElementById("profEmail").value = "";
    document.getElementById("profSenha").value = "";
    document.getElementById("profMateria").value = "";

    // limpar seleção do multi-select
    list.querySelectorAll("input").forEach(chk => chk.checked = false);
    field.textContent = "Selecione as turmas";

  } catch (err) {
    alert("Erro ao cadastrar professor: " + err.message);
  }
});




// ------------------------------------------------------------------
// CADASTRAR ALUNO
// ------------------------------------------------------------------
document.getElementById("btnCreateAluno").addEventListener("click", async () => {

  const name = document.getElementById("alunoName").value.trim();
  const email = document.getElementById("alunoEmail").value.trim();
  const senha = document.getElementById("alunoSenha").value.trim();
  const serie = document.getElementById("alunoSerie").value;

  if (!name || !email || !senha || !serie) {
    alert("Preencha todos os campos do aluno!");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
    const userId = userCredential.user.uid;

    await set(ref(db, "users/" + userId), {
      name,
      email,
      role: "student",
      serie,
      precisaTrocarSenha: true,
    });

    alert("Aluno cadastrado com sucesso!");

    document.getElementById("alunoName").value = "";
    document.getElementById("alunoEmail").value = "";
    document.getElementById("alunoSenha").value = "";
    document.getElementById("alunoSerie").value = "";

  } catch (err) {
    alert("Erro ao cadastrar aluno: " + err.message);
  }
});




// ------------------------------------------------------------------
// GERAR LISTA
// ------------------------------------------------------------------
document.getElementById("btnGerarLista").addEventListener("click", () => {

  const materia = document.getElementById("filtroMateria").value;
  const serie = document.getElementById("filtroSerie").value;
  const bimestre = document.getElementById("filtroBimestre").value;
  const aluno = document.getElementById("filtroAluno").value.trim();

  if (!materia || !serie || !bimestre) {
    alert("Selecione matéria, série e bimestre!");
    return;
  }

  localStorage.setItem("filtroMateria", materia);
  localStorage.setItem("filtroSerie", serie);
  localStorage.setItem("filtroBimestre", bimestre);

  if (aluno) {
    localStorage.setItem("filtroAluno", aluno);
  } else {
    localStorage.removeItem("filtroAluno");
  }

  setTimeout(() => {
    window.location.href = "lista.html";
  }, 300);
});




// ------------------------------------------------------------------
// LISTA DE ALUNOS
// ------------------------------------------------------------------
async function carregarListaDeAlunos() {
  try {
    const snap = await get(ref(db, "users"));
    const dados = snap.val();
    const datalist = document.getElementById("listaAlunos");

    if (!dados || !datalist) return;

    datalist.innerHTML = "";

    for (let uid in dados) {
      const user = dados[uid];
      if (user.role === "student" && user.name) {
        const option = document.createElement("option");
        option.value = user.name;
        datalist.appendChild(option);
      }
    }

  } catch (err) {
    console.error("Erro ao carregar alunos:", err);
  }
}

carregarListaDeAlunos();




// ------------------------------------------------------------------
// VER USUÁRIOS
// ------------------------------------------------------------------
document.getElementById("btnVerUsuarios").addEventListener("click", () => {
  window.location.href = "usuarios.html";
});
