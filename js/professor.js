import { auth, db } from "/js/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get, set, push, remove } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

// 🔒 PROTEÇÃO DE ROTA
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
            alert("Acesso negado: apenas professores podem acessar esta área.");
            window.location.href = "index.html";
            return;
        }
        iniciarSistemaProfessor(u);
    } catch (err) {
        console.error("Erro de autenticação:", err);
        window.location.href = "index.html";
    }
});

function iniciarSistemaProfessor(u) {
    // ELEMENTOS DO DOM
    const serieSelect = document.getElementById("serieSelect");
    const materiaSelect = document.getElementById("materiaSelect");
    const corpoTabelaNotas = document.getElementById("corpoTabelaNotas");
    const btnSalvarNotas = document.getElementById("btnSalvarNotas");
    const serieFaltasSelect = document.getElementById("serieFaltasSelect");
    const listaAlunosFaltas = document.getElementById("listaAlunosFaltas");
    const dataFaltaInput = document.getElementById("dataFalta");
    const btnSalvarFaltas = document.getElementById("btnSalvarFaltas");
    const selectBimestre = document.getElementById("selectBimestre");
    const conteudoInput = document.getElementById("conteudo");
    const dataAulaInput = document.getElementById("dataAula");
    const bimestreConteudo = document.getElementById("bimestreConteudo");
    const btnSalvarConteudo = document.getElementById("btnSalvarConteudo");
    const listaConteudos = document.getElementById("listaConteudos");
    const secaoNotas = document.getElementById("secaoNotas");
    const bimestreNotas = document.getElementById("bimestreNotas");
    const mensagemNotas = document.getElementById("mensagemNotas");

    let idEdicaoAtual = null;

    // 🛠️ FILTROS
    function inicializarFiltros() {
        materiaSelect.innerHTML = '<option value="">Selecione a série primeiro</option>';
        serieSelect.innerHTML = '<option value="">Selecione a série</option>';
        serieFaltasSelect.innerHTML = '<option value="">Selecione a série</option>';
        if (u.atribuicoes) {
            Object.keys(u.atribuicoes).sort().forEach(turma => {
                serieSelect.add(new Option(turma, turma));
                serieFaltasSelect.add(new Option(turma, turma));
            });
        }
    }

    serieSelect.addEventListener("change", () => {
        const serieEscolhida = serieSelect.value;
        materiaSelect.innerHTML = '<option value="">Selecione a matéria</option>';
        if (serieEscolhida && u.atribuicoes[serieEscolhida]) {
            const materiasDaTurma = u.atribuicoes[serieEscolhida];
            if (Array.isArray(materiasDaTurma)) {
                materiasDaTurma.forEach(m => materiaSelect.add(new Option(m, m)));
            }
        }
        atualizarVisibilidadeNotas();
    });

    inicializarFiltros();

    // 📊 NOTAS
    const atualizarVisibilidadeNotas = () => {
        if (bimestreNotas.value && materiaSelect.value && serieSelect.value) {
            secaoNotas.style.display = "block";
            mensagemNotas.style.display = "none";
            carregarTabelaNotas();
        } else {
            secaoNotas.style.display = "none";
            mensagemNotas.style.display = "block";
        }
    };

    bimestreNotas.addEventListener("change", atualizarVisibilidadeNotas);
    materiaSelect.addEventListener("change", () => {
        atualizarVisibilidadeNotas();
        carregarConteudos();
    });

    async function carregarTabelaNotas() {
        const serie = serieSelect.value;
        const materia = materiaSelect.value;
        if (!serie || !materia) return;
        corpoTabelaNotas.innerHTML = "<tr><td colspan='6'>Carregando alunos...</td></tr>";
        try {
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
                        <td><input type="number" data-campo="multidisciplinar" min="0" max="10" step="0.1" value="0"></td>
                        <td><input type="number" data-campo="avaliacao" min="0" max="10" step="0.1" value="0"></td>
                        <td><input type="number" data-campo="trabalho" min="0" max="10" step="0.1" value="0"></td>
                        <td class="td-media">0.0</td>
                        <td class="td-faltas">0</td>
                    `;
                    corpoTabelaNotas.appendChild(tr);
                }
            }
            carregarNotasExistentes();
        } catch (err) { console.error(err); }
    }

    corpoTabelaNotas.addEventListener("input", (e) => {
        if (e.target.tagName === "INPUT") {
            const tr = e.target.closest("tr");
            const m = parseFloat(tr.querySelector("[data-campo='multidisciplinar']").value) || 0;
            const a = parseFloat(tr.querySelector("[data-campo='avaliacao']").value) || 0;
            const t = parseFloat(tr.querySelector("[data-campo='trabalho']").value) || 0;
            tr.querySelector(".td-media").textContent = ((m + a + t) / 3).toFixed(1);
        }
    });

    async function carregarNotasExistentes() {
        const materia = materiaSelect.value;
        const bimestre = bimestreNotas.value;
        const linhas = corpoTabelaNotas.querySelectorAll("tr");
        for (let tr of linhas) {
            const uid = tr.dataset.uid;
            const snap = await get(ref(db, `grades/${uid}/${materia}/${bimestre}`));
            const g = snap.val();
            if (g) {
                tr.querySelector("[data-campo='multidisciplinar']").value = g.multidisciplinar ?? 0;
                tr.querySelector("[data-campo='avaliacao']").value = g.avaliacao ?? 0;
                tr.querySelector("[data-campo='trabalho']").value = g.trabalho ?? 0;
                tr.querySelector(".td-media").textContent = g.media ?? "0.0";
                tr.querySelector(".td-faltas").textContent = g.faltas ?? "0";
            }
        }
    }

    btnSalvarNotas.addEventListener("click", async () => {
        const materia = materiaSelect.value;
        const bimestre = bimestreNotas.value;
        if (!materia || !bimestre) return alert("Selecione matéria e bimestre!");
        btnSalvarNotas.disabled = true;
        btnSalvarNotas.innerText = "Salvando...";
        try {
            const linhas = corpoTabelaNotas.querySelectorAll("tr");
            for (let tr of linhas) {
                const uid = tr.dataset.uid;
                const m = parseFloat(tr.querySelector("[data-campo='multidisciplinar']").value) || 0;
                const a = parseFloat(tr.querySelector("[data-campo='avaliacao']").value) || 0;
                const t = parseFloat(tr.querySelector("[data-campo='trabalho']").value) || 0;
                const media = parseFloat(((m + a + t) / 3).toFixed(1));
                const faltas = parseInt(tr.querySelector(".td-faltas").textContent) || 0;
                await set(ref(db, `grades/${uid}/${materia}/${bimestre}`), {
                    multidisciplinar: m, avaliacao: a, trabalho: t, media: media, faltas: faltas,
                    professor: auth.currentUser.email, dataPostagem: new Date().toLocaleDateString()
                });
            }
            alert("Notas salvas com sucesso!");
        } catch (error) { alert("Erro ao salvar."); }
        finally { btnSalvarNotas.disabled = false; btnSalvarNotas.innerText = "Salvar Notas"; }
    });

    // 🗓️ FALTAS
    serieFaltasSelect.addEventListener("change", async () => {
        listaAlunosFaltas.innerHTML = "Carregando...";
        const serie = serieFaltasSelect.value;
        if (!serie) return;
        const snap = await get(ref(db, "users"));
        const data = snap.val();
        listaAlunosFaltas.innerHTML = "";
        for (let uid in data) {
            const a = data[uid];
            if (a.role === "student" && a.serie === serie) {
                listaAlunosFaltas.innerHTML += `<div><label><input type="checkbox" value="${uid}"> ${a.name}</label></div>`;
            }
        }
    });

    btnSalvarFaltas.addEventListener("click", async () => {
        const materia = materiaSelect.value;
        const dataFalta = dataFaltaInput.value;
        const bimestre = selectBimestre.value;
        if (!materia || !bimestre || !dataFalta) return alert("Preencha todos os campos.");
        const selecionados = [...listaAlunosFaltas.querySelectorAll("input:checked")].map(cb => cb.value);
        if (selecionados.length === 0) return alert("Nenhum aluno selecionado.");
        btnSalvarFaltas.disabled = true;
        try {
            for (let uid of selecionados) {
                const refGrade = ref(db, `grades/${uid}/${materia}/${bimestre}`);
                const snap = await get(refGrade);
                const atual = snap.val() || { faltas: 0 };
                await set(refGrade, { ...atual, faltas: (parseInt(atual.faltas) || 0) + 1 });
            }
            alert("Faltas registradas!");
        } catch (err) { alert("Erro ao salvar faltas."); }
        finally { btnSalvarFaltas.disabled = false; }
    });

    // 📖 CONTEÚDOS
    async function carregarConteudos() {
        const materia = materiaSelect.value;
        if (!materia) return;
        try {
            const snap = await get(ref(db, `conteudos/${auth.currentUser.uid}/${materia}`));
            const dados = snap.val();
            listaConteudos.innerHTML = "";
            if (!dados) {
                listaConteudos.innerHTML = "<li>Nenhum conteúdo lançado.</li>";
                return;
            }
            const keys = Object.keys(dados).reverse();
            keys.forEach(k => {
                const c = dados[k];
                const li = document.createElement("li");
                li.innerHTML = `
                    <span><strong>[${c.bimestre}º Bim]</strong> ${c.data} - ${c.conteudo}</span>
                    <div class="botoes-lista">
                        <button class="btn-editar" onclick="window.editarConteudo('${k}', '${c.data}', '${c.conteudo}', '${c.bimestre}')">Editar</button>
                        <button class="btn-excluir" onclick="window.excluirConteudo('${k}')">Excluir</button>
                    </div>
                `;
                listaConteudos.appendChild(li);
            });
        } catch (e) { console.error(e); }
    }

    // FUNÇÕES GLOBAIS
    window.toggleLista = () => {
        const lista = document.getElementById("listaConteudos");
        const btn = document.getElementById("btnToggleLista");
        lista.classList.toggle("escondido");
        btn.innerText = lista.classList.contains("escondido") ? "Mostrar" : "Esconder";
    };

    window.excluirConteudo = async (id) => {
        if (confirm("Deseja realmente excluir este conteúdo?")) {
            const materia = materiaSelect.value;
            try {
                await remove(ref(db, `conteudos/${auth.currentUser.uid}/${materia}/${id}`));
                alert("Conteúdo excluído!");
                carregarConteudos();
            } catch (e) { alert("Erro ao excluir."); }
        }
    };

    window.editarConteudo = (id, data, conteudo, bimestre) => {
        idEdicaoAtual = id;
        dataAulaInput.value = data;
        conteudoInput.value = conteudo;
        bimestreConteudo.value = bimestre;
        btnSalvarConteudo.innerText = "Atualizar Conteúdo";
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    btnSalvarConteudo.addEventListener("click", async () => {
        const materia = materiaSelect.value;
        if (!materia || !conteudoInput.value) return alert("Preencha os campos.");
        const dados = { data: dataAulaInput.value, conteudo: conteudoInput.value.trim(), bimestre: bimestreConteudo.value };
        try {
            if (idEdicaoAtual) {
                await set(ref(db, `conteudos/${auth.currentUser.uid}/${materia}/${idEdicaoAtual}`), dados);
                idEdicaoAtual = null;
                btnSalvarConteudo.innerText = "Salvar Conteúdo";
            } else {
                const newRef = push(ref(db, `conteudos/${auth.currentUser.uid}/${materia}`));
                await set(newRef, dados);
            }
            conteudoInput.value = "";
            carregarConteudos();
            alert("Sucesso!");
        } catch (e) { alert("Erro ao salvar."); }
    });

    // 🚪 LOGOUT
    document.querySelector(".btn-logout").addEventListener("click", async () => {
        if (confirm("Deseja sair do sistema?")) {
            await signOut(auth);
            window.location.href = "index.html";
        }
    });
}