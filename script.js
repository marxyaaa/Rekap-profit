/**
 * MODULE: Konfigurasi & State
 */
const Config = {
    START_DATE: "2026-01-19",
    STORAGE_KEY: 'kas_v11_journey'
};

let appState = {
    focusedDate: new Date(),
    transactions: JSON.parse(localStorage.getItem(Config.STORAGE_KEY)) || []
};
appState.focusedDate.setHours(0,0,0,0);

/**
 * MODULE: Utilitas UI (Format Angka & Mata Uang)
 */
const UIModule = {
    formatRupiah(num) {
        let prefix = num < 0 ? '- Rp ' : 'Rp ';
        return prefix + Math.abs(num).toLocaleString('id-ID');
    },
    handleFormat(input) {
        let val = input.value.replace(/\./g, '');
        if (!isNaN(val) && val !== "") {
            input.value = parseInt(val).toLocaleString('id-ID');
        }
    },
    cleanNum(str) {
        return parseInt(str.replace(/\./g, '')) || 0;
    }
};

/**
 * MODULE: Manajemen Tanggal
 */
const DateModule = {
    getAppStartDate() {
        let d = new Date(Config.START_DATE);
        d.setHours(0,0,0,0);
        return d;
    },
    changeDate(offset) {
        let newDate = new Date(appState.focusedDate);
        newDate.setDate(newDate.getDate() + offset);
        if (newDate < this.getAppStartDate()) return;
        appState.focusedDate = newDate;
        CoreLogic.render();
    },
    getDayNumber(date) {
        const diff = Math.floor((date - this.getAppStartDate()) / (1000 * 60 * 60 * 24));
        return diff + 1;
    },
    formatFullDate(date) {
        return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
};

/**
 * MODULE: Transaksi & Profit
 */
const TransactionModule = {
    calcPreview() {
        const modal = UIModule.cleanNum(document.getElementById('costPrice').value);
        const jual = UIModule.cleanNum(document.getElementById('sellPrice').value);
        const box = document.getElementById('previewBox');
        if (modal > 0 || jual > 0) {
            box.style.display = 'block';
            document.getElementById('liveProfit').innerText = UIModule.formatRupiah(jual - modal);
        } else { box.style.display = 'none'; }
    },
    saveProfit() {
        const name = document.getElementById('itemName').value || "Jualan";
        const modal = UIModule.cleanNum(document.getElementById('costPrice').value);
        const jual = UIModule.cleanNum(document.getElementById('sellPrice').value);
        if (jual === 0) return;

        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');

        appState.transactions.unshift({
            id: Date.now(), desc: name, amount: jual - modal,
            modal, jual, type: 'plus', isProfit: true, 
            date: appState.focusedDate.toISOString(),
            time: timeStr
        });
        CoreLogic.save();
        this.clearProfitForm();
    },
    saveTransaction() {
        const desc = document.getElementById('desc').value;
        const amt = UIModule.cleanNum(document.getElementById('amount').value);
        const type = document.getElementById('type').value;
        if (!desc || amt <= 0) return;

        const now = new Date();
        const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');

        appState.transactions.unshift({
            id: Date.now(), desc, amount: amt, type, isProfit: false, 
            date: appState.focusedDate.toISOString(),
            time: timeStr
        });
        CoreLogic.save();
        this.clearKasForm();
    },
    deleteItem(id) {
        appState.transactions = appState.transactions.filter(t => t.id !== id);
        CoreLogic.save();
    },
    clearProfitForm() {
        document.getElementById('itemName').value = '';
        document.getElementById('costPrice').value = '';
        document.getElementById('sellPrice').value = '';
        document.getElementById('previewBox').style.display = 'none';
    },
    clearKasForm() {
        document.getElementById('desc').value = '';
        document.getElementById('amount').value = '';
    }
};

/**
 * MODULE: Core Logic (Render & Data Persistence)
 */
const CoreLogic = {
    save() {
        localStorage.setItem(Config.STORAGE_KEY, JSON.stringify(appState.transactions));
        this.render();
    },
    render() {
        const list = document.getElementById('historyList');
        list.innerHTML = '';
        
        // Header Info
        document.getElementById('displayDayNum').innerText = `HARI KE-${DateModule.getDayNumber(appState.focusedDate)}`;
        document.getElementById('displayFullDate').innerText = DateModule.formatFullDate(appState.focusedDate);
        document.getElementById('prevBtn').disabled = (DateModule.getDayNumber(appState.focusedDate) <= 1);

        let totals = { saldo: 0, dayInc: 0, dayExp: 0, count: 0, week: 0, month: 0, year: 0 };
        const now = new Date();
        const focusedISO = appState.focusedDate.toISOString().split('T')[0];

        // Hitung Rentang Minggu Ini (Senin)
        const firstDayOfWeek = new Date(now);
        const day = now.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        firstDayOfWeek.setDate(now.getDate() + diffToMonday);
        firstDayOfWeek.setHours(0,0,0,0);

        appState.transactions.forEach(t => {
            const isPlus = t.type === 'plus';
            const val = isPlus ? t.amount : -t.amount;
            const tDate = new Date(t.date);

            totals.saldo += val;

            // Periodik
            if (tDate >= firstDayOfWeek) totals.week += val;
            if (tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear()) totals.month += val;
            if (tDate.getFullYear() === now.getFullYear()) totals.year += val;

            // Item Per Hari Terfokus
            if (t.date.split('T')[0] === focusedISO) {
                totals.count++;
                if (isPlus) totals.dayInc += t.amount;
                else totals.dayExp += t.amount;

                this.appendHistoryItem(list, t, isPlus);
            }
        });

        this.updateUI(totals);
        if (list.innerHTML === '') {
            list.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding: 40px 20px; background:white; border-radius:20px; border: 1px dashed #cbd5e1;">Belum ada catatan hari ini</div>`;
        }
    },
    appendHistoryItem(container, t, isPlus) {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div class="item-info">
                <span class="item-meta">Pukul ${t.time || '--:--'} • ${t.isProfit ? 'PROFIT' : 'KAS'}</span>
                <b>${t.desc}</b>
                ${t.isProfit ? `<small style="font-size:0.65rem; color:var(--text-muted)">M: ${t.modal.toLocaleString()} | J: ${t.jual.toLocaleString()}</small>` : ''}
            </div>
            <div style="text-align:right; display:flex; align-items:center;">
                <b class="${isPlus ? 'text-success' : 'text-danger'}">${isPlus ? '+' : '-'}${t.amount.toLocaleString()}</b>
                <button class="delete-btn" onclick="TransactionModule.deleteItem(${t.id})">×</button>
            </div>
        `;
        container.appendChild(item);
    },
    updateUI(totals) {
        document.getElementById('itemCount').innerText = `${totals.count} TRANSAKSI`;
        const mainCard = document.getElementById('mainCard');
        const balanceText = document.getElementById('totalBalance');
        
        balanceText.innerText = UIModule.formatRupiah(totals.saldo);
        mainCard.className = totals.saldo < 0 ? 'card-main is-minus' : 'card-main';

        document.getElementById('dayIncome').innerText = UIModule.formatRupiah(totals.dayInc);
        document.getElementById('dayExpense').innerText = UIModule.formatRupiah(totals.dayExp);
        
        this.setPeriodicColor('weekProfit', totals.week);
        this.setPeriodicColor('monthProfit', totals.month);
        this.setPeriodicColor('yearProfit', totals.year);
    },
    setPeriodicColor(id, val) {
        const el = document.getElementById(id);
        el.innerText = UIModule.formatRupiah(val);
        el.className = val < 0 ? 'text-danger' : (val > 0 ? 'text-success' : '');
    }
};

// Inisialisasi Pertama
CoreLogic.render();