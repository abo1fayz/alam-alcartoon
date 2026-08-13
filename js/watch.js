/* ============================================================
   watch.js — صفحة المشاهدة
   يقبل مرجع فيديو VK مباشرًا أو مرجع wall محفوظًا من لوحة التحكم.
   ============================================================ */

(async function () {
  const pageEl = document.getElementById("page");
  const params = new URLSearchParams(location.search);
  const episodeId = params.get("id");

  document.getElementById("year").textContent = new Date().getFullYear();

  const menuBtn = document.getElementById("menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  menuBtn?.addEventListener("click", () => mobileMenu?.classList.add("is-open"));
  mobileMenu?.addEventListener("click", (e) => {
    if (e.target === mobileMenu) mobileMenu.classList.remove("is-open");
  });

  if (!episodeId) {
    pageEl.innerHTML = `<div class="error-box">معرف الحلقة مفقود من الرابط</div>`;
    return;
  }

  const { data: episode, error: eError } = await sb
    .from(TABLES.episodes)
    .select(`
      id, title, description, vk_video_id, views,
      thumbnail_url, episode_number, updated_at,
      seasons!inner (
        id, season_number,
        cartoons!inner ( id, title )
      )
    `)
    .eq("id", episodeId)
    .single();

  if (eError || !episode) {
    pageEl.innerHTML = `
      <div class="error-box">
        <p>لم يتم العثور على الحلقة</p>
        <br>
        <a class="btn btn--primary" href="index.html">العودة للرئيسية</a>
      </div>`;
    return;
  }

  const season = episode.seasons;
  const cartoon = season?.cartoons;
  incrementEpisodeViews(episodeId);

  const { data: allEpisodes } = await sb
    .from(TABLES.episodes)
    .select("id, title, episode_number, views, thumbnail_url")
    .eq("season_id", season.id)
    .order("episode_number", { ascending: true });

  const sorted = (allEpisodes || []).sort((a, b) => a.episode_number - b.episode_number);
  const idx = sorted.findIndex((ep) => ep.id === episodeId);
  const prev = idx > 0 ? sorted[idx - 1] : null;
  const next = idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;

  pageEl.innerHTML = `
    <div class="player-wrap">
      <div id="vk-player" class="vk-player" aria-label="مشغل VK">
        <div class="spinner"></div>
        <p class="vk-player__loading">جارٍ تجهيز مشغل VK...</p>
      </div>
    </div>

    <div class="episode-info">
      <span class="episode-info__series">${esc(cartoon?.title || "—")}</span>
      <h1 class="episode-info__title">${esc(episode.title || `الحلقة ${episode.episode_number}`)}</h1>
      <div class="episode-info__meta">
        الموسم ${season.season_number} · الحلقة ${episode.episode_number}
        · ${fmtNum(episode.views)} مشاهدة
      </div>
      <p class="episode-info__desc">${esc(episode.description)}</p>
    </div>

    <div class="nav-episodes">
      ${prev
        ? `<a class="btn btn--ghost" href="watch.html?id=${prev.id}">→ الحلقة السابقة</a>`
        : `<span class="btn btn--ghost" style="opacity:.4;cursor:default">→ لا توجد حلقة سابقة</span>`}
      ${next
        ? `<a class="btn btn--primary" href="watch.html?id=${next.id}">الحلقة التالية ←</a>`
        : `<span class="btn btn--primary" style="opacity:.4;cursor:default">لا توجد حلقة تالية ←</span>`}
    </div>

    <div class="section">
      <div class="section__head">
        <h2 class="section__title">جميع حلقات الموسم ${season.season_number}</h2>
      </div>
      <div class="episodes-list">
        ${sorted
          .map((ep) =>
            episodeRow({ ...ep }).replace(
              "episode-row\"",
              `episode-row ${ep.id === episodeId ? "is-current" : ""}\"`
            )
          )
          .join("")}
      </div>
    </div>
  `;

  await renderMedia(episode.vk_video_id);

  async function renderMedia(reference) {
    const player = document.getElementById("vk-player");
    const parsed = parseMediaReference(reference);
    if (!player || !parsed.valid) {
      if (player) {
        player.innerHTML = `
          <div class="vk-player__fallback">
            <p>${esc(parsed.message || "مرجع VK غير صالح لهذه الحلقة.")}</p>
            <small>يجب حفظ رابط video_ext أو كود التضمين المصدر من VK في لوحة التحكم.</small>
          </div>`;
      }
      return;
    }

    if (parsed.kind === "youtube") {
      player.innerHTML = `
        <div class="youtube-player" data-plyr-provider="youtube" data-plyr-embed-id="${esc(parsed.videoId)}"></div>`;
      const youtubeElement = player.querySelector(".youtube-player");
      if (!youtubeElement || !window.Plyr) {
        player.innerHTML = `<div class="vk-player__fallback"><p>تعذر تحميل مشغل YouTube.</p><small>تحقق من اتصال الإنترنت ثم أعد تحميل الصفحة.</small></div>`;
        return;
      }
      const restrictYouTubeFrame = () => {
        youtubeElement.querySelectorAll("iframe").forEach((frame) => {
          frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
          frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        });
      };
      const frameObserver = new MutationObserver(restrictYouTubeFrame);
      frameObserver.observe(youtubeElement, { childList: true, subtree: true });

      const youtubePlayer = new window.Plyr(youtubeElement, {
        controls: ["play-large", "play", "progress", "current-time", "mute", "volume", "settings", "fullscreen"],
        clickToPlay: true,
        keyboard: { focused: true, global: false },
        tooltips: { controls: true, seek: true },
        youtube: {
          noCookie: true,
          rel: 0,
          iv_load_policy: 3,
          modestbranding: 1,
          playsinline: 1,
          origin: window.location.origin,
        },
      });
      youtubePlayer.on("ready", restrictYouTubeFrame);
      setTimeout(restrictYouTubeFrame, 0);
      return;
    }

    if (parsed.kind === "video") {
      const src = parsed.embedUrl || `https://vk.ru/video_ext.php?oid=${encodeURIComponent(parsed.ownerId)}&id=${encodeURIComponent(parsed.videoId)}`;
      player.innerHTML = `
        <iframe
          src="${esc(src)}"
          frameborder="0"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture; screen-wake-lock"
          allowfullscreen
          loading="eager"
          referrerpolicy="strict-origin-when-cross-origin"
          title="مشغل فيديو VK داخل موقع عالم الكرتون"></iframe>`;
      return;
    }

    if (parsed.kind === "wall" && parsed.hash) {
      player.innerHTML = `<div id="vk-post-embed" class="vk-post-embed"></div>`;
      try {
        await loadVKOpenAPI();
        if (!window.VK?.Widgets?.Post) throw new Error("VK Widgets غير متاح");
        window.VK.Widgets.Post(
          "vk-post-embed",
          Number(parsed.ownerId),
          Number(parsed.postId),
          parsed.hash,
          { width: "100%" }
        );
      } catch (error) {
        player.innerHTML = `
          <div class="vk-player__fallback">
            <p>تعذر تحميل منشور VK داخل الموقع.</p>
            <small>تحقق من أن كود التضمين من VK كامل وأن المنشور عام.</small>
          </div>`;
        console.warn("تعذر تضمين منشور VK:", error);
      }
      return;
    }

    player.innerHTML = `
      <div class="vk-player__fallback">
        <p>هذا رابط wall فقط ولا يكفي لتشغيل الفيديو داخل الموقع.</p>
        <small>من VK اختر مشاركة ← تصدير، ثم الصق كود التضمين كاملًا في لوحة التحكم.</small>
      </div>`;
  }

  function loadVKOpenAPI() {
    if (window.VK?.Widgets?.Post) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-vk-openapi]");
      if (existing) {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", () => reject(new Error("VK OpenAPI failed")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = "https://vk.ru/js/api/openapi.js?169";
      script.async = true;
      script.charset = "windows-1251";
      script.dataset.vkOpenapi = "true";
      script.onload = resolve;
      script.onerror = () => reject(new Error("VK OpenAPI failed"));
      document.head.appendChild(script);
    });
  }
})();
