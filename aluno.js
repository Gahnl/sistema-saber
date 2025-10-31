import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

const notasList = document.getElementById("notasList");

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "index.html"; return; }

  const snap = await get(ref(db, 'users/' + user.uid));
  const u = snap.val();
  if (!u || u.role !== "student") { alert("Acesso negado"); window.location.href = "index.html"; return; }

  const gradesSnap = await get(ref(db,'grades/'+user.uid));
  const grades = gradesSnap.val();
  notasList.innerHTML = "";
  if (!grades) { notasList.innerHTML = "<li>Nenhuma nota lançada ainda.</li>"; return; }

  for (const materia in grades) {
    const it = grades[materia];
    const li = document.createElement("li");
    li.textContent = `${materia}: ${it.nota} (Professor: ${it.professor})`;
    notasList.appendChild(li);
  }
});

document.getElementById("sairBtn").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "index.html";
});
