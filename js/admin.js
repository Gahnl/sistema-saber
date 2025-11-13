// js/login.js
import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

// --------- LOGIN ---------
document.getElementById("btnLogin").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const senha = document.getElementById("loginSenha").value.trim();

  if (!email || !senha) {
    alert("Preencha todos os campos!");
    return;
  }

  try {
    // Tenta autenticar o usuário no Firebase
    const userCredential = await signInWithEmailAndPassword(auth, email, senha);
    const user = userCredential.user;

    // Busca os dados no Realtime Database
    const snap = await get(ref(db, "users/" + user.uid));

    if (!snap.exists()) {
      alert("Usuário não encontrado no banco de dados.");
      await signOut(auth);
      return;
    }

    const dados = snap.val();

    // 🔹 Verifica se precisa trocar a senha
    if (dados.precisaTrocarSenha === true) {
      // Armazena temporariamente o ID do usuário
      localStorage.setItem("usuarioID", user.uid);
      alert("Por segurança, altere sua senha antes de continuar.");
      window.location.href = "alterar-senha.html"; // redireciona
      return;
    }

    // 🔹 Redirecionamento por tipo de usuário
    if (dados.role === "teacher") {
      window.location.href = "painel_professor.html";
    } else if (dados.role === "student") {
      window.location.href = "painel_aluno.html";
    } else {
      window.location.href = "admin.html"; // caso seja administrador
    }
  } catch (err) {
    alert("Erro ao fazer login: " + err.message);
  }
});
