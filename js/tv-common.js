// EPG 캐시 유틸리티
const EpgCache = {
    TTL: 2 * 60 * 60 * 1000, // 2시간

    _key(epgUrl) { return 'epgCache_' + btoa(epgUrl); },

    get(epgUrl) {
        try {
            const cacheKey = this._key(epgUrl);
            const cachedTime = parseInt(localStorage[cacheKey + '_time']);
            if (cachedTime && (Date.now() - cachedTime < this.TTL) && localStorage[cacheKey]) {
                const remaining = Math.round((this.TTL - (Date.now() - cachedTime)) / 60000);
                console.log('EPG 캐시 사용 (남은시간:', remaining, '분)');
                return localStorage[cacheKey];
            }
        } catch(e) {}
        return null;
    },

    set(epgUrl, xml) {
        try {
            const cacheKey = this._key(epgUrl);
            localStorage[cacheKey] = xml;
            localStorage[cacheKey + '_time'] = Date.now();
        } catch(e) {
            console.warn('EPG 캐시 저장 실패 (용량 초과 가능):', e);
        }
    },

    clear() {
        Object.keys(localStorage).forEach(k => {
            if (k.startsWith('epgCache_')) delete localStorage[k];
        });
    }
};

// 로고 fallback 맵
const LOGO_FALLBACK_MAP = (() => {
    const wm = 'https://upload.wikimedia.org/wikipedia/commons/thumb';
    return {
        'SBS':        `${wm}/9/90/SBS_Korea_Logo_%28Word_Only%29.svg/512px-SBS_Korea_Logo_%28Word_Only%29.svg.png`,
        'SBS Sports': `${wm}/9/90/SBS_Korea_Logo_%28Word_Only%29.svg/512px-SBS_Korea_Logo_%28Word_Only%29.svg.png`,
        'SBS Plus':   `${wm}/a/a4/SBS_Plus_logo_2018.svg/512px-SBS_Plus_logo_2018.svg.png`,
        'KBS 1TV':    `${wm}/d/d5/KBS_1_logo.svg/512px-KBS_1_logo.svg.png`,
        'KBS 2TV':    `${wm}/2/26/KBS_2_logo.svg/512px-KBS_2_logo.svg.png`,
        'MBC':        `${wm}/6/63/Munhwa_Broadcasting_Company.svg/512px-Munhwa_Broadcasting_Company.svg.png`,
        'EBS 1':      `${wm}/e/e2/EBS_1TV_Logo.svg/512px-EBS_1TV_Logo.svg.png`,
        'EBS 2':      `${wm}/d/db/EBS_2TV_Logo.svg/512px-EBS_2TV_Logo.svg.png`,
        'KBS DRAMA':  `${wm}/f/f2/KBS_DRAMA.svg/512px-KBS_DRAMA.svg.png`,
        'KBS JOY':    `${wm}/6/6b/KBS_JOY.svg/512px-KBS_JOY.svg.png`,
        'KBS KIDS':   `${wm}/a/a5/KBS_kids.svg/512px-KBS_kids.svg.png`,
        'KBS Life':   `${wm}/6/64/KBS_Life.svg/512px-KBS_Life.svg.png`,
        'KBS WORLD':  `${wm}/1/1b/KBS_World_%282009%29.svg/512px-KBS_World_%282009%29.svg.png`,
    };
})();

// Vue mixin - index.html과 player.html에서 공유
const TvMixin = {
    computed: {
        epgInfoMap() {
            if (!this.now || !this.epgData) return {};
            const map = {};
            (this.m3us || []).forEach(m3u => {
                const key = m3u.attributes['tvg-id'] || m3u.attributes['tvg-name'];
                if (key && !(key in map)) {
                    map[key] = this.getEpgInfo(key);
                }
            });
            return map;
        }
    },
    methods: {
        handleLogoError(item) {
            if (item.logoRetried) return;
            item.logoRetried = true;
            const name = item.attributes['tvg-name'] || item.attributes['tvg-id'];
            if (!name) return;
            const fallbackUrl = LOGO_FALLBACK_MAP[name];
            if (fallbackUrl) {
                this.$set(item.attributes, 'tvg-logo', fallbackUrl);
            }
        },

        getEpgInfo(channel) {
            if (!channel || !this.epgData || !this.epgData[channel]) return null;
            const now = this.now ? this.now.toDate() : new Date();
            const programs = this.epgData[channel];
            const prog = programs.find(p => now >= p.start && now < p.stop);
            if (!prog) return null;
            const totalMs = prog.stop - prog.start;
            const elapsedMs = now - prog.start;
            const progress = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100));
            return {
                title: prog.title,
                startStr: dayjs(prog.start).format('HH:mm'),
                endStr: dayjs(prog.stop).format('HH:mm'),
                progress
            };
        },

        parseEPG(xmlContent) {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

            const channelMap = {};
            const channels = xmlDoc.getElementsByTagName("channel");
            for (let i = 0; i < channels.length; i++) {
                const ch = channels[i];
                const id = ch.getAttribute("id");
                const displayNames = ch.getElementsByTagName("display-name");
                const names = [];
                for (let j = 0; j < displayNames.length; j++) {
                    names.push(displayNames[j].textContent);
                }
                channelMap[id] = names;
            }

            const programmes = xmlDoc.getElementsByTagName("programme");
            const newEpgData = {};
            const epgHour = this.epgHour;

            const parseDate = (dateStr) => {
                if (!dateStr) return null;
                const y = dateStr.substring(0, 4);
                const m = parseInt(dateStr.substring(4, 6)) - 1;
                const d = dateStr.substring(6, 8);
                const h = dateStr.substring(8, 10);
                const min = dateStr.substring(10, 12);
                const s = dateStr.substring(12, 14);

                let date;
                const tzMatch = dateStr.trim().match(/([+-]\d{4})$/);
                if (tzMatch) {
                    const tzStr = tzMatch[1];
                    const tzSign = tzStr[0] === '+' ? 1 : -1;
                    const tzH = parseInt(tzStr.substring(1, 3));
                    const tzM = parseInt(tzStr.substring(3, 5));
                    const tzOffsetMs = tzSign * (tzH * 60 + tzM) * 60000;
                    const utcMs = Date.UTC(y, m, d, h, min, s) - tzOffsetMs;
                    date = new Date(utcMs);
                } else {
                    date = new Date(y, m, d, h, min, s);
                }

                if (epgHour) {
                    date.setHours(date.getHours() + parseInt(epgHour));
                }
                return date;
            };

            for (let i = 0; i < programmes.length; i++) {
                const prog = programmes[i];
                const channelId = prog.getAttribute("channel");
                const start = parseDate(prog.getAttribute("start"));
                const stop = parseDate(prog.getAttribute("stop"));
                let title = "No Title";
                const titleNode = prog.getElementsByTagName("title")[0];
                if (titleNode) title = titleNode.textContent;
                if (!newEpgData[channelId]) newEpgData[channelId] = [];
                newEpgData[channelId].push({ start, stop, title });
            }

            for (const [id, names] of Object.entries(channelMap)) {
                if (!newEpgData[id]) continue;
                for (const name of names) {
                    if (name !== id && !newEpgData[name]) {
                        newEpgData[name] = newEpgData[id];
                    }
                }
            }

            this.epgData = newEpgData;
        }
    }
};
