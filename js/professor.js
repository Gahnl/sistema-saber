import { auth, db } from "./firebase.js";
import { ref, get, set } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

const serieSelect = document.getElementById("serieSelect");
const alunoSelect = document.getElementById("alunoSelect");
const btnLancarNota = document.getElementById("btnLancarNota");

serieSelect.addEventListener("change", async () => {
  alunoSelect.innerHTML = '<option value="">Selecione o aluno</option>';
  const serie = serieSelect.value;
  if (!serie) return;

  const snapshot = await get(ref(db, 'users'));
  const data = snapshot.val();
  for (let uid in data) {
    const u = data[uid];
    if (u.role === "student" && u.serie === serie) {
      const option = document.createElement("option");
      option.value = uid;
      option.textContent = u.name;
      alunoSelect.appendChild(option);
    }
  }
});

btnLancarNota.addEventListener("click", async () => {
  const aluno = alunoSelect.value;
  const materia = document.getElementById("materia").value;
  const nota = document.getElementById("nota").value;

  if (!aluno || !materia || nota === "") {
    alert("Preencha todos os campos!");
    return;
  }

  try {
    await set(ref(db, `grades/${aluno}/${materia}`), {
      nota: Number(nota),
      professor: auth.currentUser ? auth.currentUser.email : "Professor"
    });
    alert("Nota lançada com sucesso!");
  } catch (err) {
    alert("Erro ao lançar nota: " + err.message);
  }
});

document.querySelector("a[href='index.html']").addEventListener("click", async () => {
  await signOut(auth);
});
