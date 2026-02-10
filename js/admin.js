import { auth, db, firebaseConfig } from "/js/firebase.js";
import { ref, set, get, remove, onValue, update } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";
import { onAuthStateChanged, getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";

// Variáveis globais de controle
let atribuicoesProfessor = {};
let editandoProfessorUid = null;

// ------------------------------------------------------------------
// 🔒 PROTEÇÃO DE ROTA
// ------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    try {
        const snap = await get(ref(db, "users/" + user.uid));
        if (!snap.exists() || snap.val().role !== "admin") {
            window.location.href = "index.html";
        } else {
            carregarListasUsuarios();
            carregarAlunosDatalist();
        }
    } catch (err) { window.location.href = "index.html"; }
});

// ------------------------------------------------------------------
// 📋 GERENCIAMENTO DE EXIBIÇÃO (TOGGLES)
// ------------------------------------------------------------------
function setupToggles() {
    const btnProf = document.getElementById("btnToggleProf");
    const btnAlu = document.getElementById("btnToggleAlunos");
    const contProf = document.getElementById("containerProfessores");
    const contAlu = document.getElementById("containerAlunos");

    btnProf?.addEventListener("click", () => {
        const isHidden = contProf.style.display === "none";
        contProf.style.display = isHidden ? "block" : "none";
        contAlu.style.display = "none";
        btnProf.textContent = isHidden ? "📁 Fechar Professores" : "📂 Ver Professores";
    });

    btnAlu?.addEventListener("click", () => {
        const isHidden = contAlu.style.display === "none";
        contAlu.style.display = isHidden ? "block" : "none";
        contProf.style.display = "none";
        btnAlu.textContent = isHidden ? "📁 Fechar Alunos" : "📂 Ver Alunos";
    });
}
setupToggles();

// ------------------------------------------------------------------
// 📋 LISTAR USUÁRIOS
// ------------------------------------------------------------------
function carregarListasUsuarios() {
    const listaProf = document.getElementById("listaProfessores");
    const listaAlu = document.getElementById("listaAlunosCadastrados");

    onValue(ref(db, "users"), (snapshot) => {
        if (!snapshot.exists()) return;
        const usuarios = snapshot.val();
        listaProf.innerHTML = "";
        listaAlu.innerHTML = "";

        for (let uid in usuarios) {
            const user = usuarios[uid];
            const tr = document.createElement("tr");

            if (user.role === "teacher") {
                let atribStr = "-";
                if (user.atribuicoes) {
                    atribStr = Object.entries(user.atribuicoes)
                        .map(([turma, mats]) => `${turma} (${mats.join(", ")})`)
                        .join(" | ");
                }
                tr.innerHTML = `
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>${atribStr}</td>
                    <td>
                        <button onclick="prepararEdicaoProf('${uid}')" style="background-color: #f8f008; color: #32066d; border:none; padding:5px 10px; cursor:pointer; margin-right:5px; border-radius:4px; font-weight:bold;">Editar</button>
                        <button onclick="removerUser('${uid}')" class="btn-delete">Excluir</button>
                    </td>`;
                listaProf.appendChild(tr);
            } else if (user.role === "student") {
                tr.innerHTML = `
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>${user.serie || "-"}</td>
                    <td><button onclick="removerUser('${uid}')" class="btn-delete">Excluir</button></td>`;
                listaAlu.appendChild(tr);
            }
        }
    });
}

// ------------------------------------------------------------------
// 🛠️ LÓGICA DE EDIÇÃO E CADASTRO
// ------------------------------------------------------------------

window.prepararEdicaoProf = async (uid) => {
    try {
        const snap = await get(ref(db, "users/" + uid));
        if (!snap.exists()) return;
        const prof = snap.val();

        document.getElementById("profName").value = prof.name;
        document.getElementById("profEmail").value = prof.email;
        document.getElementById("profEmail").disabled = true; 
        document.getElementById("profSenha").placeholder = "Bloqueado na edição";
        document.getElementById("profSenha").disabled = true; 

        // IMPORTANTE: Carregamos as atribuições que já existem no banco para a memória
        atribuicoesProfessor = JSON.parse(JSON.stringify(prof.atribuicoes || {}));
        editandoProfessorUid = uid;

        renderizarListaAtribuicoes();
        document.getElementById("btnCreateProf").textContent = "💾 Salvar Alterações";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { alert("Erro ao carregar: " + e.message); }
};

document.getElementById("btnAddAtribuicao")?.addEventListener("click", () => {
    const checksTurmas = document.querySelectorAll("#listTurmaAtribuicao input:checked");
    const checksMaterias = document.querySelectorAll("#listMatAtribuicao input:checked");
    
    const turmas = Array.from(checksTurmas).map(c => c.value);
    const materias = Array.from(checksMaterias).map(c => c.value);

    if (turmas.length === 0 || materias.length === 0) return alert("Selecione turma e matéria!");

    turmas.forEach(t => {
        if (atribuicoesProfessor[t]) {
            atribuicoesProfessor[t] = Array.from(new Set([...atribuicoesProfessor[t], ...materias]));
        } else {
            atribuicoesProfessor[t] = materias;
        }
    });

    renderizarListaAtribuicoes();
    
    checksTurmas.forEach(c => c.checked = false);
    checksMaterias.forEach(c => c.checked = false);
    document.getElementById("fieldTurmaAtribuicao").textContent = "Selecionar Turmas";
    document.getElementById("fieldMatAtribuicao").textContent = "Selecionar Matérias";
});

function renderizarListaAtribuicoes() {
    const listaUI = document.getElementById("listaAtribuidas");
    listaUI.innerHTML = "";
    for (let t in atribuicoesProfessor) {
        const li = document.createElement("li");
        li.innerHTML = `<b>${t}:</b> ${atribuicoesProfessor[t].join(", ")} 
                        <button type="button" onclick="removerAtribuicao('${t}')" style="color:red; border:none; background:none; cursor:pointer; font-weight:bold;">[x]</button>`;
        listaUI.appendChild(li);
    }
}

window.removerAtribuicao = (turma) => {
    delete atribuicoesProfessor[turma];
    renderizarListaAtribuicoes();
};

document.getElementById("btnCreateProf")?.addEventListener("click", async () => {
    const name = document.getElementById("profName").value.trim();
    const email = document.getElementById("profEmail").value.trim();
    const senha = document.getElementById("profSenha").value.trim();

    if (!name || !email || (Object.keys(atribuicoesProfessor).length === 0)) 
        return alert("Preencha nome e adicione atribuições!");

    try {
        if (editandoProfessorUid) {
            // MODO EDIÇÃO - USANDO UPDATE MULTI-PATH (Mais seguro)
            const updates = {};
            updates[`/users/${editandoProfessorUid}/name`] = name;
            updates[`/users/${editandoProfessorUid}/atribuicoes`] = atribuicoesProfessor;

            await update(ref(db), updates);
            alert("Professor atualizado com sucesso!");
        } else {
            // MODO CADASTRO NOVO
            if (!senha) return alert("Senha é obrigatória!");
            const dados = { name, email, role: "teacher", atribuicoes: atribuicoesProfessor, precisaTrocarSenha: true };
            await criarUsuarioNoSecondaryApp(email, senha, dados);
            alert("Professor cadastrado!");
        }
        resetarFormularioProf();
    } catch (e) { 
        console.error(e);
        alert("Erro ao salvar: " + e.message); 
    }
});

function resetarFormularioProf() {
    atribuicoesProfessor = {};
    editandoProfessorUid = null;
    document.getElementById("profName").value = "";
    document.getElementById("profEmail").value = "";
    document.getElementById("profEmail").disabled = false;
    document.getElementById("profSenha").value = "";
    document.getElementById("profSenha").disabled = false;
    document.getElementById("profSenha").placeholder = "Senha";
    document.getElementById("btnCreateProf").textContent = "Finalizar Cadastro do Professor";
    document.getElementById("listaAtribuidas").innerHTML = "";
    document.getElementById("fieldTurmaAtribuicao").textContent = "Selecionar Turmas";
    document.getElementById("fieldMatAtribuicao").textContent = "Selecionar Matérias";
    // Não damos reload() imediatamente para o alert não sumir antes do usuário ler
}

// ------------------------------------------------------------------
// 🚀 MULTISELECT DINÂMICO (TEXTO VISUAL)
// ------------------------------------------------------------------
function setupMultiSelect(fieldId, listId, defaultText) {
    const field = document.getElementById(fieldId);
    const list = document.getElementById(listId);
    
    field?.addEventListener("click", (e) => {
        e.stopPropagation();
        list.style.display = list.style.display === "block" ? "none" : "block";
    });

    list?.addEventListener("change", () => {
        const checks = list.querySelectorAll("input:checked");
        const sel = Array.from(checks).map(c => c.value);
        field.textContent = sel.length ? sel.join(", ") : defaultText;
        field.style.fontWeight = sel.length ? "bold" : "normal";
        field.style.color = sel.length ? "#32066d" : "#666";
    });

    document.addEventListener("click", (e) => { 
        if (!field?.contains(e.target) && !list?.contains(e.target)) list.style.display = "none"; 
    });
}

setupMultiSelect("fieldTurmaAtribuicao", "listTurmaAtribuicao", "Selecionar Turmas");
setupMultiSelect("fieldMatAtribuicao", "listMatAtribuicao", "Selecionar Matérias");

// ------------------------------------------------------------------
// 🚀 OUTRAS FUNÇÕES (ALUNOS, PDF, BUSCA)
// ------------------------------------------------------------------

async function criarUsuarioNoSecondaryApp(email, senha, dadosPublicos) {
    const appName = "TempApp_" + Date.now();
    const tempApp = initializeApp(firebaseConfig, appName);
    const tempAuth = getAuth(tempApp);
    try {
        const uc = await createUserWithEmailAndPassword(tempAuth, email, senha);
        await set(ref(db, "users/" + uc.user.uid), dadosPublicos);
        await signOut(tempAuth);
        await deleteApp(tempApp);
        return true;
    } catch (error) { await deleteApp(tempApp); throw error; }
}

window.removerUser = async (uid) => {
    if (confirm("Deseja realmente excluir?")) {
        try { await remove(ref(db, "users/" + uid)); alert("Removido!"); } 
        catch (e) { alert(e.message); }
    }
};

document.getElementById("btnCreateAluno")?.addEventListener("click", async () => {
    const name = document.getElementById("alunoName").value.trim();
    const email = document.getElementById("alunoEmail").value.trim();
    const senha = document.getElementById("alunoSenha").value.trim();
    const serie = document.getElementById("alunoSerie").value;
    if (!name || !email || !senha || !serie) return alert("Preencha tudo!");
    try {
        await criarUsuarioNoSecondaryApp(email, senha, { name, email, role: "student", serie, precisaTrocarSenha: true });
        alert("Aluno cadastrado!");
        location.reload();
    } catch (e) { alert(e.message); }
});

const setupSearch = (inputId, tableBodyId) => {
    document.getElementById(inputId)?.addEventListener("keyup", (e) => {
        const term = e.target.value.toLowerCase();
        const rows = document.getElementById(tableBodyId).querySelectorAll("tr");
        rows.forEach(row => row.style.display = row.innerText.toLowerCase().includes(term) ? "" : "none");
    });
};
setupSearch("buscaProf", "listaProfessores");
setupSearch("buscaAluno", "listaAlunosCadastrados");

// --- Visualização do Boletim ---
let dadosGlobaisBoletim = [];
let alunoSelecionadoNome = "";

document.getElementById("btnVisualizarBoletim")?.addEventListener("click", async () => {
    const nome = document.getElementById("filtroAluno").value.trim();
    const serie = document.getElementById("filtroSerie").value;
    const corpo = document.getElementById("tabelaCorpoPreview");
    if (!nome || !serie) return alert("Selecione Aluno e Série!");

    try {
        const usersSnap = await get(ref(db, "users"));
        const users = usersSnap.val();
        let alunoUID = Object.keys(users).find(uid => users[uid].name === nome);
        if (!alunoUID) return alert("Aluno não encontrado!");

        const gradesSnap = await get(ref(db, `grades/${alunoUID}`));
        const notas = gradesSnap.val() || {};
        const materias = ["Matemática", "Português", "Arte", "História", "Geografia", "Informática", "Inglês", "Ciências", "Educação Física", "Música", "Espanhol"];
        
        corpo.innerHTML = "";
        dadosGlobaisBoletim = [];
        alunoSelecionadoNome = nome;
        document.getElementById("infoAlunoPreview").innerText = `${nome} - ${serie}`;

        materias.forEach(mat => {
            let somaMedias = 0, totalFaltas = 0, bimsComNota = 0;
            let nBims = [];
            for(let b=1; b<=4; b++) {
                const dado = notas[mat] ? notas[mat][b] : null;
                const nota = dado ? (dado.media || "0") : "-";
                nBims.push(nota);
                if(dado) { somaMedias += parseFloat(dado.media); totalFaltas += parseInt(dado.faltas); bimsComNota++; }
            }
            const mediaFinal = bimsComNota > 0 ? (somaMedias / bimsComNota).toFixed(1) : "-";
            const tr = document.createElement("tr");
            tr.innerHTML = `<td>${mat}</td><td>${nBims[0]}</td><td>${nBims[1]}</td><td>${nBims[2]}</td><td>${nBims[3]}</td><td>${mediaFinal}</td><td>${totalFaltas}</td>`;
            corpo.appendChild(tr);
            dadosGlobaisBoletim.push([mat, nBims[0], nBims[1], nBims[2], nBims[3], mediaFinal, totalFaltas]);
        });
        document.getElementById("areaPreview").style.display = "block";
    } catch (e) { alert("Erro ao carregar boletim."); }
});

document.getElementById("btnBaixarPDFConfirmado")?.addEventListener("click", () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("BOLETIM - COLÉGIO SABER", 10, 10);
    doc.autoTable({ head: [['Matéria', '1ºB', '2ºB', '3ºB', '4ºB', 'Média', 'Faltas']], body: dadosGlobaisBoletim });
    doc.save(`Boletim_${alunoSelecionadoNome}.pdf`);
});

document.getElementById("btnFecharPreview")?.addEventListener("click", () => document.getElementById("areaPreview").style.display = "none");

async function carregarAlunosDatalist() {
    const snap = await get(ref(db, "users"));
    const dados = snap.val();
    const datalist = document.getElementById("listaAlunos");
    if (!dados || !datalist) return;
    datalist.innerHTML = "";
    for (let uid in dados) {
        if (dados[uid].role === "student") {
            const opt = document.createElement("option");
            opt.value = dados[uid].name;
            datalist.appendChild(opt);
        }
    }
}