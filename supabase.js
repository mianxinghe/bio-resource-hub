/* Minimal Supabase client via fetch (no SDK/CDN dependency). */
window.SUPA = (function () {
  function cfg() {
    var c = window.APP_CONFIG;
    if (c && c.supabaseUrl && c.supabaseAnonKey) {
      return { url: c.supabaseUrl.replace(/\/+$/, ""), anon: c.supabaseAnonKey };
    }
    return null;
  }
  function enabled() { return !!cfg(); }
  function headers(c) {
    return { apikey: c.anon, Authorization: "Bearer " + c.anon, "Content-Type": "application/json" };
  }
  function ext(name) {
    var i = name.lastIndexOf(".");
    return i >= 0 ? name.slice(i).toLowerCase() : "";
  }

  async function listFiles() {
    var c = cfg(); if (!c) return [];
    var r = await fetch(c.url + "/rest/v1/files?select=*&order=created_at.desc", { headers: headers(c) });
    if (!r.ok) throw new Error("读取云端列表失败 " + r.status);
    return r.json();
  }

  async function uploadFile(file, meta) {
    var c = cfg(); if (!c) throw new Error("后端未配置");
    var safe = file.name.replace(/[\\/:*?"<>|#%\s]+/g, "_").slice(0, 80);
    var path = meta.course + "/" + Date.now() + "-" + safe;
    var up = await fetch(c.url + "/storage/v1/object/uploads/" + encodeURIComponent(path), {
      method: "POST",
      headers: {
        apikey: c.anon,
        Authorization: "Bearer " + c.anon,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: file,
    });
    if (!up.ok) throw new Error("上传文件失败 " + up.status);
    var row = {
      course: meta.course,
      title: meta.title || file.name,
      type: meta.type,
      size: file.size,
      ext: ext(file.name),
      storage_path: path,
      uploader: meta.uploader || "",
    };
    var ins = await fetch(c.url + "/rest/v1/files", {
      method: "POST",
      headers: Object.assign({}, headers(c), { Prefer: "return=representation" }),
      body: JSON.stringify(row),
    });
    if (!ins.ok) throw new Error("保存信息失败 " + ins.status);
    return ins.json();
  }

  async function deleteFile(id, pwd) {
    var c = cfg(); if (!c) throw new Error("后端未配置");
    var r = await fetch(c.url + "/rest/v1/rpc/delete_file", {
      method: "POST",
      headers: headers(c),
      body: JSON.stringify({ p_id: id, p_pwd: pwd }),
    });
    if (!r.ok) throw new Error("删除失败 " + r.status);
    var data = await r.json();
    return data === true;
  }

  function publicUrl(path) {
    var c = cfg();
    return c.url + "/storage/v1/object/public/uploads/" + encodeURIComponent(path);
  }

  return { enabled, listFiles, uploadFile, deleteFile, publicUrl, ext };
})();
