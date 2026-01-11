/**
 * Local-First Dynamic Form Generator
 * Built with Vanilla JS & Web Standard APIs
 */

class FormManager {
    constructor() {
        this.dbName = "FormGeneratorDB";
        this.dbVersion = 1;
        this.db = null;
        this.currentSchema = null;
        this.allSubmissions = []; // 缓存所有数据以便过滤
        this.init();
    }

    async init() {
        await this.initDB();
        await this.loadPersistedSchema();
        this.setupEventListeners();
        this.checkUrlParams();
    }

    // --- IndexedDB ---
    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains("submissions")) {
                    db.createObjectStore("submissions", {
                        keyPath: "id",
                        autoIncrement: true,
                    });
                }
                if (!db.objectStoreNames.contains("configs")) {
                    db.createObjectStore("configs", { keyPath: "id" });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.loadSubmissions();
                resolve();
            };

            request.onerror = () => reject("Database error");
        });
    }

    async saveSubmission(data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
                ["submissions"],
                "readwrite",
            );
            const store = transaction.objectStore("submissions");
            const request = store.add({
                schemaTitle: this.currentSchema.formTitle,
                timestamp: new Date().toISOString(),
                data: data,
            });

            request.onsuccess = () => {
                this.showToast("数据保存成功！");
                this.loadSubmissions();
                resolve();
            };
            request.onerror = () => reject("Save failed");
        });
    }

    async loadSubmissions() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
                ["submissions"],
                "readonly",
            );
            const store = transaction.objectStore("submissions");
            const request = store.getAll();

            request.onsuccess = () => {
                this.allSubmissions = request.result;
                this.renderDataTable(this.allSubmissions);
                resolve(this.allSubmissions);
            };
        });
    }

    async clearAllData() {
        if (!confirm("确定要清空所有已保存的数据吗？此操作不可逆。")) return;
        const transaction = this.db.transaction(["submissions"], "readwrite");
        const store = transaction.objectStore("submissions");
        store.clear();
        this.showToast("数据已清空");
        this.loadSubmissions();
    }

    async saveSchema(schema) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(["configs"], "readwrite");
            const store = transaction.objectStore("configs");
            store.put({ id: "current_schema", data: schema });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject("Save schema failed");
        });
    }

    async loadPersistedSchema() {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(["configs"], "readonly");
            const store = transaction.objectStore("configs");
            const request = store.get("current_schema");

            request.onsuccess = () => {
                if (request.result) {
                    const schema = request.result.data;
                    document.getElementById("schema-input").value =
                        JSON.stringify(schema, null, 4);
                    this.renderForm(schema, false); // false = don't switch tab automatically on auto-load
                }
                resolve();
            };
            request.onerror = () => resolve();
        });
    }

    // --- Dynamic Form Engine ---
    renderForm(schema, shouldSwitchTab = true) {
        this.currentSchema = schema;
        const container = document.getElementById("form-fields-container");
        const titleEl = document.getElementById("dynamic-form-title");
        const actionGroup = document.querySelector(".form-actions");

        container.innerHTML = "";
        titleEl.textContent = schema.formTitle || "预览表单";
        actionGroup.style.display = "flex";

        schema.fields.forEach((field) => {
            const group = document.createElement("div");
            group.className = "form-group";

            const label = document.createElement("label");
            label.textContent = field.label;
            if (field.required) label.className = "required";
            group.appendChild(label);

            let input;
            switch (field.type) {
                case "textarea":
                    input = document.createElement("textarea");
                    input.placeholder = field.placeholder || "";
                    break;
                case "select":
                    input = document.createElement("select");
                    field.options.forEach((opt) => {
                        const o = document.createElement("option");
                        o.value = opt.value;
                        o.textContent = opt.label;
                        input.appendChild(o);
                    });
                    break;
                case "radio":
                    input = document.createElement("div");
                    input.className = "radio-group";
                    field.options.forEach((opt, idx) => {
                        const wrapper = document.createElement("label");
                        wrapper.className = "radio-item";
                        const rd = document.createElement("input");
                        rd.type = "radio";
                        rd.name = field.fieldName;
                        rd.value = opt.value;
                        if (field.required && idx === 0) rd.required = true;
                        wrapper.appendChild(rd);
                        wrapper.appendChild(document.createTextNode(opt.label));
                        input.appendChild(wrapper);
                    });
                    break;
                default: // input, number, tel
                    input = document.createElement("input");
                    input.type = field.type === "number" ? "number" : "text";
                    if (field.type === "number") input.step = "any"; // 支持小数点
                    input.placeholder = field.placeholder || "";
                    if (field.validation) input.pattern = field.validation;
            }

            if (field.type !== "radio") {
                input.name = field.fieldName;
                input.id = `field-${field.fieldName}`;
                if (field.required) input.required = true;
            }

            group.appendChild(input);
            container.appendChild(group);
        });

        if (shouldSwitchTab) {
            this.showToast("表单生成成功！");
            this.switchTab("form-view");
        }
    }

    // --- UI Logic ---
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll(".tab-btn").forEach((btn) => {
            btn.addEventListener("click", () =>
                this.switchTab(btn.dataset.tab),
            );
        });

        // Form generation
        document
            .getElementById("generate-form-btn")
            .addEventListener("click", () => {
                const raw = document.getElementById("schema-input").value;
                try {
                    const schema = JSON.parse(raw);
                    this.renderForm(schema);
                    this.saveSchema(schema);
                } catch (e) {
                    this.showToast("JSON 格式错误，请检查", "error");
                }
            });

        // Form submission
        document
            .getElementById("dynamic-form")
            .addEventListener("submit", (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = {};
                formData.forEach((value, key) => {
                    data[key] = value;
                });
                this.saveSubmission(data);
                e.target.reset();
            });

        // Export data
        document
            .getElementById("export-csv-btn")
            .addEventListener("click", () => this.exportToCSV());

        // Clear data
        document
            .getElementById("clear-data-btn")
            .addEventListener("click", () => this.clearAllData());

        // Load Example
        document
            .getElementById("load-example-btn")
            .addEventListener("click", () => {
                fetch("template/form.json")
                    .then((r) => r.json())
                    .then((data) => {
                        document.getElementById("schema-input").value =
                            JSON.stringify(data, null, 4);
                    })
                    .catch(() => {
                        // Fallback example if fetch fails (e.g. file:// restriction)
                        const example = {
                            formTitle: "示例表单",
                            fields: [
                                {
                                    label: "姓名",
                                    fieldName: "name",
                                    type: "input",
                                    required: true,
                                },
                                {
                                    label: "意见",
                                    fieldName: "feedback",
                                    type: "textarea",
                                },
                            ],
                        };
                        document.getElementById("schema-input").value =
                            JSON.stringify(example, null, 4);
                    });
            });

        // Data Filtering
        const filterInput = document.getElementById("data-filter-input");
        if (filterInput) {
            filterInput.addEventListener("input", (e) => {
                this.handleFilter(e.target.value);
            });
        }
    }

    handleFilter(query) {
        if (!query) {
            this.renderDataTable(this.allSubmissions);
            return;
        }

        const searchTerm = query.toLowerCase();
        const filtered = this.allSubmissions.filter((s) => {
            // 在 ID、提交时间、表单类型以及所有数据字段中搜索
            const searchableText = [
                s.id.toString(),
                new Date(s.timestamp).toLocaleString(),
                s.schemaTitle,
                ...Object.values(s.data),
            ]
                .join("|")
                .toLowerCase();

            return searchableText.includes(searchTerm);
        });

        this.renderDataTable(filtered);
    }

    switchTab(tabId) {
        document.querySelectorAll(".tab-btn").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.tab === tabId);
        });
        document.querySelectorAll(".tab-content").forEach((content) => {
            content.classList.toggle("active", content.id === tabId);
        });
    }

    renderDataTable(submissions) {
        const head = document.getElementById("table-head");
        const body = document.getElementById("table-body");

        if (submissions.length === 0) {
            head.innerHTML = "<th>暂无数据</th>";
            body.innerHTML =
                '<tr><td style="text-align:center">请先填写表单并提交</td></tr>';
            return;
        }

        // Build fieldName -> label mapping from current schema
        const labelMap = {};
        if (this.currentSchema && this.currentSchema.fields) {
            this.currentSchema.fields.forEach((field) => {
                labelMap[field.fieldName] = field.label;
            });
        }

        // Get all unique keys from all submissions
        const keys = new Set(["ID", "提交时间", "表单类型"]);
        submissions.forEach((s) => {
            Object.keys(s.data).forEach((k) => keys.add(k));
        });

        const columns = Array.from(keys);
        // Map fieldName to label for display, fallback to fieldName if no label found
        // 添加"操作"列在最前面
        head.innerHTML =
            "<th>操作</th>" +
            columns.map((k) => `<th>${labelMap[k] || k}</th>`).join("");

        body.innerHTML = submissions
            .map((s) => {
                const dataColumnKeys = columns.slice(3); // 除去 ID、提交时间、表单类型外的字段
                return `<tr data-id="${s.id}">
                <td class="action-cell">
                    <span class="edit-btn" onclick="app.toggleEditRow(this)">编辑</span>
                </td>
                <td data-field="id" data-editable="false">${s.id}</td>
                <td data-field="timestamp" data-editable="false">${new Date(
                    s.timestamp,
                ).toLocaleString()}</td>
                <td data-field="schemaTitle" data-editable="false">${
                    s.schemaTitle
                }</td>
                ${dataColumnKeys
                    .map(
                        (k) =>
                            `<td data-field="${k}" data-editable="true">${
                                s.data[k] || "-"
                            }</td>`,
                    )
                    .join("")}
            </tr>`;
            })
            .join("");
    }

    toggleEditRow(btnEl) {
        const row = btnEl.closest("tr");
        const isEditing = row.classList.contains("editing");

        if (isEditing) {
            // 保存编辑
            this.saveRowEdit(row);
            btnEl.textContent = "编辑";
            row.classList.remove("editing");

            // 将所有可编辑单元格从 input 还原为文本
            row.querySelectorAll('td[data-editable="true"]').forEach((td) => {
                const input = td.querySelector("input");
                if (input) {
                    td.textContent = input.value || "-";
                }
            });
        } else {
            // 进入编辑模式
            btnEl.textContent = "保存";
            row.classList.add("editing");

            // 将所有可编辑单元格转为 input
            row.querySelectorAll('td[data-editable="true"]').forEach((td) => {
                const currentValue =
                    td.textContent === "-" ? "" : td.textContent;
                const fieldName = td.dataset.field;
                td.innerHTML = `<input type="text" class="cell-input" value="${this.escapeHtml(
                    currentValue,
                )}" data-field="${fieldName}">`;
            });
        }
    }

    saveRowEdit(row) {
        const id = parseInt(row.dataset.id, 10);
        const updates = {};

        row.querySelectorAll('td[data-editable="true"] input').forEach(
            (input) => {
                updates[input.dataset.field] = input.value;
            },
        );

        this.updateSubmission(id, updates);
    }

    async updateSubmission(id, updates) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
                ["submissions"],
                "readwrite",
            );
            const store = transaction.objectStore("submissions");
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const record = getRequest.result;
                if (record) {
                    // 更新 data 字段
                    Object.keys(updates).forEach((key) => {
                        record.data[key] = updates[key];
                    });
                    const putRequest = store.put(record);
                    putRequest.onsuccess = () => {
                        this.showToast("数据更新成功！");
                        resolve();
                    };
                    putRequest.onerror = () => reject("Update failed");
                } else {
                    reject("Record not found");
                }
            };
            getRequest.onerror = () => reject("Get failed");
        });
    }

    escapeHtml(text) {
        const div = document.createElement("div");
        div.textContent = text;
        return div.innerHTML.replace(/"/g, "&quot;");
    }

    exportToCSV() {
        const transaction = this.db.transaction(["submissions"], "readonly");
        const store = transaction.objectStore("submissions");
        const request = store.getAll();

        request.onsuccess = () => {
            const data = request.result;
            if (data.length === 0) return this.showToast("没有可导出的数据");

            const keys = new Set(["ID", "Timestamp", "FormTitle"]);
            data.forEach((s) =>
                Object.keys(s.data).forEach((k) => keys.add(k)),
            );
            const columns = Array.from(keys);

            let csv = "\uFEFF"; // UTF-8 BOM for Excel
            csv += columns.join(",") + "\n";

            data.forEach((s) => {
                const row = [
                    s.id,
                    s.timestamp,
                    s.schemaTitle,
                    ...columns.slice(3).map((k) => {
                        let val = s.data[k] || "";
                        return `"${String(val).replace(/"/g, '""')}"`;
                    }),
                ];
                csv += row.join(",") + "\n";
            });

            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `form_data_${new Date().getTime()}.csv`;
            link.click();
        };
    }

    showToast(msg, type = "success") {
        const toast = document.getElementById("toast");
        toast.textContent = msg;
        toast.style.background =
            type === "error" ? "var(--danger-color)" : "#333";
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 3000);
    }

    checkUrlParams() {
        // Option to auto-load if schema passed in hash (useful for local-first sharing)
        const hash = window.location.hash.substring(1);
        if (hash) {
            try {
                const schema = JSON.parse(decodeURIComponent(hash));
                document.getElementById("schema-input").value = JSON.stringify(
                    schema,
                    null,
                    4,
                );
                this.renderForm(schema);
            } catch (e) {}
        }
    }
}

// Start the app
document.addEventListener("DOMContentLoaded", () => {
    window.app = new FormManager();
});
