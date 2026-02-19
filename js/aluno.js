import { auth, db } from "/js/firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

const tabelaNotas = document.querySelector("#tabelaNotas tbody");

// ------------------------------------------------------------------
// 📋 CONFIGURAÇÃO PADRÃO - COLÉGIO SABER
// ------------------------------------------------------------------
const MATERIAS_PADRAO = [
    "Arte", "Ciências", "Educação Física", "Espanhol", "Geografia", 
    "História", "Informática", "Inglês", "Matemática", "Música", "Português"
];

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "index.html";
        return;
    }

    try {
        // Busca notas e faltas simultaneamente
        const [snapGrades, snapFaltas] = await Promise.all([
            get(ref(db, `grades/${user.uid}`)),
            get(ref(db, `faltas/${user.uid}`))
        ]);

        const grades = snapGrades.val() || {};
        const faltas = snapFaltas.val() || {};

        renderTabela(grades, faltas);

    } catch (e) {
        console.error("Erro ao carregar dados:", e);
        tabelaNotas.innerHTML = `<tr><td colspan="6">Erro ao carregar boletim.</td></tr>`;
    }
});

function renderTabela(grades, faltas) {
    tabelaNotas.innerHTML = "";

    MATERIAS_PADRAO.forEach(materia => {
        const dadosMateria = grades[materia] || {};
        const faltasMateria = faltas[materia] || {};

        // Organiza os dados dos 4 bimestres
        const bimestres = {
            1: { nota: dadosMateria["1"]?.media ?? "-", falta: faltasMateria["1"] ?? 0 },
            2: { nota: dadosMateria["2"]?.media ?? "-", falta: faltasMateria["2"] ?? 0 },
            3: { nota: dadosMateria["3"]?.media ?? "-", falta: faltasMateria["3"] ?? 0 },
            4: { nota: dadosMateria["4"]?.media ?? "-", falta: faltasMateria["4"] ?? 0 }
        };

        // Cálculos de Média e Faltas Totais
        let somaNotas = 0;
        let qtdBimestresComNota = 0;
        let somaFaltas = 0;

        [1, 2, 3, 4].forEach(n => {
            const nNota = bimestres[n].nota;
            const nFalta = bimestres[n].falta;

            if (nNota !== "-") {
                somaNotas += Number(nNota);
                qtdBimestresComNota++;
            }
            somaFaltas += Number(nFalta);
        });

        const mediaFinal = qtdBimestresComNota > 0 ? (somaNotas / qtdBimestresComNota).toFixed(1) : "-";

        // Criação da linha na tabela
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td><strong>${materia}</strong></td>
            ${[1, 2, 3, 4].map(n => `
                <td style="text-align: center;">
                    <span style="font-weight: bold; color: ${bimestres[n].nota < 6 && bimestres[n].nota !== '-' ? 'red' : 'inherit'}">
                        ${bimestres[n].nota}
                    </span><br>
                    <small style="color: #666;">Faltas: ${bimestres[n].falta}</small>
                </td>
            `).join("")}
            <td style="text-align: center;">
                <strong>${mediaFinal}</strong><br>
                <small>Total Faltas: ${somaFaltas}</small>
            </td>
        `;
        tabelaNotas.appendChild(tr);
    });
}

// ------------------------------------------------------------------
// 🚪 LOGOUT
// ------------------------------------------------------------------
document.getElementById("sairBtn")?.addEventListener("click", async () => {
    if(confirm("Deseja realmente sair?")) {
        await signOut(auth);
        window.location.href = "index.html";
    }
});