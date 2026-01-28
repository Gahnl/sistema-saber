import { auth, db, firebaseConfig } from "/js/firebase.js";
import { ref, set, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";
import { onAuthStateChanged, getAuth, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { initializeApp, deleteApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";

// ------------------------------------------------------------------
// 🔒 PROTEÇÃO DE ROTA
// ------------------------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "index.html"; return; }
    try {
        const snap = await get(ref(db, "users/" + user.uid));
        if (!snap.exists() || snap.val().role !== "admin") {
            window.location.href = "index.html";
        }
    } catch (err) { 
        window.location.href = "index.html"; 
    }
});

// ------------------------------------------------------------------
// 🛠️ FUNÇÃO: CADASTRAR SEM DESLOGAR O ADMIN
// ------------------------------------------------------------------
async function criarUsuarioNoSecondaryApp(email, senha, dadosPublicos) {
    const tempApp = initializeApp(firebaseConfig, "TempRegistration");
    const tempAuth = getAuth(tempApp);
    try {
        const uc = await createUserWithEmailAndPassword(tempAuth, email, senha);
        await set(ref(db, "users/" + uc.user.uid), dadosPublicos);
        await signOut(tempAuth);
        await deleteApp(tempApp);
        return true;
    } catch (error) {
        await deleteApp(tempApp);
        throw error;
    }
}

// ------------------------------------------------------------------
// MULTI SELECTS (TURMAS E MATÉRIAS)
// ------------------------------------------------------------------
function setupMultiSelect(fieldId, listId) {
    const field = document.getElementById(fieldId);
    const list = document.getElementById(listId);
    if (field && list) {
        field.addEventListener("click", (e) => {
            e.stopPropagation();
            list.style.display = list.style.display === "block" ? "none" : "block";
        });
        document.addEventListener("click", (e) => { 
            if (!field.contains(e.target) && !list.contains(e.target)) list.style.display = "none"; 
        });
    }
}

setupMultiSelect("multiSelectField", "multiSelectList");
setupMultiSelect("multiSelectMateriaField", "multiSelectMateriaList");

window.getTurmasSelecionadas = () => [...document.querySelectorAll("#multiSelectList input:checked")].map(chk => chk.value);
window.getMateriasSelecionadas = () => [...document.querySelectorAll("#multiSelectMateriaList input:checked")].map(chk => chk.value);

document.getElementById("multiSelectList")?.addEventListener("change", () => {
    const sel = window.getTurmasSelecionadas();
    document.getElementById("multiSelectField").textContent = sel.length ? sel.join(", ") : "Selecione as turmas";
});

document.getElementById("multiSelectMateriaList")?.addEventListener("change", () => {
    const sel = window.getMateriasSelecionadas();
    document.getElementById("multiSelectMateriaField").textContent = sel.length ? sel.join(", ") : "Selecione as matérias";
});

// ------------------------------------------------------------------
// CADASTRAR PROFESSOR / ALUNO
// ------------------------------------------------------------------
document.getElementById("btnCreateProf")?.addEventListener("click", async () => {
    const name = document.getElementById("profName").value.trim();
    const email = document.getElementById("profEmail").value.trim();
    const senha = document.getElementById("profSenha").value.trim();
    const materias = window.getMateriasSelecionadas();
    const turmas = window.getTurmasSelecionadas();

    if (!name || !email || !senha || materias.length === 0 || turmas.length === 0) return alert("Preencha tudo!");

    try {
        const dados = {
            name, email, role: "teacher", precisaTrocarSenha: true,
            subjects: materias.reduce((acc, m) => { acc[m] = true; return acc; }, {}),
            classes: turmas.reduce((acc, t) => { acc[t] = true; return acc; }, {})
        };
        await criarUsuarioNoSecondaryApp(email, senha, dados);
        alert("Professor cadastrado!");
        location.reload();
    } catch (e) { alert("Erro: " + e.message); }
});

document.getElementById("btnCreateAluno")?.addEventListener("click", async () => {
    const name = document.getElementById("alunoName").value.trim();
    const email = document.getElementById("alunoEmail").value.trim();
    const senha = document.getElementById("alunoSenha").value.trim();
    const serie = document.getElementById("alunoSerie").value;
    if (!name || !email || !senha || !serie) return alert("Preencha tudo!");
    try {
        const dados = { name, email, role: "student", serie, precisaTrocarSenha: true };
        await criarUsuarioNoSecondaryApp(email, senha, dados);
        alert("Aluno cadastrado!");
        location.reload();
    } catch (e) { alert("Erro: " + e.message); }
});

// ------------------------------------------------------------------
// VISUALIZAR BOLETIM E PDF
// ------------------------------------------------------------------
let dadosGlobaisBoletim = [];
let alunoSelecionadoNome = "";

document.getElementById("btnVisualizarBoletim").addEventListener("click", async () => {
    const nome = document.getElementById("filtroAluno").value.trim();
    const serie = document.getElementById("filtroSerie").value;
    const corpo = document.getElementById("tabelaCorpoPreview");

    if (!nome || !serie) return alert("Selecione o Aluno e a Série!");

    try {
        const usersSnap = await get(ref(db, "users"));
        const users = usersSnap.val();
        let alunoUID = Object.keys(users).find(uid => users[uid].name === nome);
        if (!alunoUID) return alert("Aluno não encontrado!");

        const gradesSnap = await get(ref(db, `grades/${alunoUID}`));
        const notas = gradesSnap.val() || {};
        const materias = ["Matemática", "Português", "Arte", "História", "Geografia", "Informática", "Inglês", "Ciências", "Educação Física"];
        
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
                if(dado) {
                    somaMedias += parseFloat(dado.media || 0);
                    totalFaltas += parseInt(dado.faltas || 0);
                    bimsComNota++;
                }
            }
            const mediaFinal = bimsComNota > 0 ? (somaMedias / bimsComNota).toFixed(1) : "-";
            const corMedia = (mediaFinal !== "-" && parseFloat(mediaFinal) < 6) ? "red" : "blue";

            const tr = document.createElement("tr");
            tr.innerHTML = `<td style="text-align:left; padding:10px;"><b>${mat}</b></td>
                <td>${nBims[0]}</td><td>${nBims[1]}</td><td>${nBims[2]}</td><td>${nBims[3]}</td>
                <td style="color:${corMedia}; font-weight:bold;">${mediaFinal}</td><td>${totalFaltas}</td>`;
            corpo.appendChild(tr);
            dadosGlobaisBoletim.push([mat, nBims[0], nBims[1], nBims[2], nBims[3], mediaFinal, totalFaltas]);
        });
        document.getElementById("areaPreview").style.display = "block";
        document.getElementById("areaPreview").scrollIntoView({ behavior: 'smooth' });
    } catch (err) { alert("Erro ao carregar prévia: " + err.message); }
});

// --- FUNÇÃO DE DOWNLOAD DO PDF (CORRIGIDA PARA EVITAR ERRO F3) ---
document.getElementById("btnBaixarPDFConfirmado").addEventListener("click", () => {
    const jsPDFRef = (window.jspdf && window.jspdf.jsPDF) ? window.jspdf.jsPDF : (window.jsPDF ? window.jsPDF : null);

    if (!jsPDFRef) return alert("Erro: Biblioteca de PDF não carregada!");
    if (dadosGlobaisBoletim.length === 0) return alert("Visualize os dados primeiro!");

    try {
        const doc = new jsPDFRef();
        const serie = document.getElementById("filtroSerie").value;

        doc.setFontSize(18);
        doc.setTextColor(50, 6, 109);
        doc.text("COLÉGIO SABER", 105, 15, { align: "center" });
        
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);
        doc.text(`BOLETIM ANUAL - ${alunoSelecionadoNome} (${serie})`, 105, 25, { align: "center" });

        doc.autoTable({
            startY: 35,
            head: [['Matéria', '1ºB', '2ºB', '3ºB', '4ºB', 'Média', 'Faltas']],
            body: dadosGlobaisBoletim,
            theme: 'grid',
            headStyles: { fillColor: [50, 6, 109], textColor: [248, 240, 8] },
            styles: { halign: 'center' },
            didDrawCell: (data) => {
                if (data.section === 'body' && data.column.index === 5) {
                    const texto = data.cell.raw;
                    const v = parseFloat(texto);

                    // Proteção: Só muda cor se for um número válido. Se for "-", usa preto.
                    if (!isNaN(v)) {
                        if (v < 6) {
                            doc.setTextColor(255, 0, 0); // Vermelho
                        } else {
                            doc.setTextColor(0, 0, 255); // Azul
                        }
                    } else {
                        doc.setTextColor(0, 0, 0); // Preto padrão para "-"
                    }
                }
            }
        });

        doc.save(`Boletim_${alunoSelecionadoNome.replace(/\s+/g, '_')}.pdf`);
    } catch (e) {
        console.error("Erro PDF:", e);
        alert("Erro ao gerar PDF: " + e.message);
    }
});

document.getElementById("btnFecharPreview")?.addEventListener("click", () => {
    document.getElementById("areaPreview").style.display = "none";
});

// ------------------------------------------------------------------
// AUXILIARES
// ------------------------------------------------------------------
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
carregarAlunosDatalist();

document.getElementById("btnGerarLista")?.addEventListener("click", () => {
    const m = document.getElementById("filtroMateria").value;
    const s = document.getElementById("filtroSerie").value;
    const b = document.getElementById("filtroBimestre").value;
    if (!m || !s || !b) return alert("Filtros incompletos!");
    localStorage.setItem("filtroMateria", m); 
    localStorage.setItem("filtroSerie", s); 
    localStorage.setItem("filtroBimestre", b);
    window.location.href = "lista.html";
});

document.getElementById("btnVerUsuarios")?.addEventListener("click", () => window.location.href = "usuarios.html");