/**
 * タブを閉じるまで覚えておく値（sessionStorage）。読み込み直しても、カートと注文の依頼の冪等キーが消えないように。
 * 使えない環境（プライベートな窓、保存を止めた設定）では、覚えないだけで動きは変わらない。
 */
export function load(name: string): string | null {
  try {
    return window.sessionStorage.getItem(name);
  } catch {
    return null;
  }
}

export function save(name: string, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(name);
    else window.sessionStorage.setItem(name, value);
  } catch {
    // 覚えられなくても困らない
  }
}
