import { Copy, Download } from 'lucide-react';
import qrcode from 'qrcode-generator';
import { useMemo, useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Checkbox, Field, TextInput } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';

/**
 * Doğrulama uygulaması için QR kodu. Gizli anahtar hiçbir dış servise gönderilmez; kod tarayıcıda
 * SVG olarak çizilir. Okutulamazsa anahtar elle girilebilsin diye ayrıca yazılı gösterilir.
 */
export function TotpQr({ otpauthUrl, secret }: { otpauthUrl: string; secret: string }) {
  const cells = useMemo(() => {
    const code = qrcode(0, 'M');
    code.addData(otpauthUrl);
    code.make();
    const count = code.getModuleCount();
    const dark: string[] = [];
    for (let row = 0; row < count; row += 1) {
      for (let col = 0; col < count; col += 1) {
        if (code.isDark(row, col)) dark.push(`M${col} ${row}h1v1h-1z`);
      }
    }
    return { count, path: dark.join('') };
  }, [otpauthUrl]);

  return (
    <div className="stack stack--sm">
      <svg
        className="totp-qr"
        viewBox={`-2 -2 ${cells.count + 4} ${cells.count + 4}`}
        role="img"
        aria-label="Doğrulama uygulamasıyla okutulacak QR kodu"
        shapeRendering="crispEdges"
      >
        <path d={cells.path} fill="currentColor" />
      </svg>
      <p className="meta">QR okutulamıyorsa uygulamaya bu anahtarı elle girin:</p>
      <p className="secret-text" aria-label="Gizli anahtar">
        {secret}
      </p>
    </div>
  );
}

/** 6 haneli doğrulama kodu alanı (telefon klavyesinde rakam). */
export function CodeField({
  label = 'Doğrulama kodu',
  value,
  onChange,
  error,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | undefined;
}) {
  return (
    <Field label={label} required error={error} hint="Doğrulama uygulamasındaki 6 haneli kod.">
      {(props) => (
        <TextInput
          {...props}
          className="code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
        />
      )}
    </Field>
  );
}

function downloadText(fileName: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Kurtarma kodları yalnız bu ekranda bir kez gösterilir ve indirilebilir; hiçbir depoya yazılmaz.
 * Kullanıcı kaydettiğini onaylamadan devam edemez.
 */
export function RecoveryCodes({
  codes,
  username,
  onDone,
  doneLabel,
}: {
  codes: string[];
  username: string;
  onDone: () => void;
  doneLabel: string;
}) {
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = [
    'Şantiye Hesap — ürün sahibi kurtarma kodları',
    `Hesap: ${username}`,
    'Her kod yalnız bir kez kullanılabilir.',
    '',
    ...codes,
    '',
  ].join('\n');

  return (
    <div className="stack">
      <div className="alert alert--danger" role="alert">
        <p className="alert__title">Bu kodları çevrimdışı ve güvenli bir yerde saklayın</p>
        <p>
          Kodlar yalnız şimdi gösterilir; bu ekrandan çıkınca yeniden görüntülenemez. Telefonunuzu
          kaybederseniz giriş için bu kodlardan birini kullanırsınız. Her kod tek kullanımlıktır.
        </p>
      </div>
      <ol className="recovery-codes" aria-label="Kurtarma kodları">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ol>
      <div className="row">
        <Button
          variant="secondary"
          onClick={() => downloadText('santiye-hesap-kurtarma-kodlari.txt', text)}
        >
          <Icon icon={Download} />
          Kodları indir
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard
              ?.writeText(codes.join('\n'))
              .then(() => setCopied(true))
              .catch(() => setCopied(false));
          }}
        >
          <Icon icon={Copy} />
          {copied ? 'Kopyalandı' : 'Kopyala'}
        </Button>
      </div>
      <Checkbox
        label="Kodları güvenli bir yere kaydettim."
        checked={saved}
        onChange={(event) => setSaved(event.target.checked)}
      />
      <div className="form-actions">
        <Button disabled={!saved} onClick={onDone}>
          {doneLabel}
        </Button>
      </div>
    </div>
  );
}
