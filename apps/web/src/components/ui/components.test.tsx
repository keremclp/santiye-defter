import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Amount } from './Amount';
import { Button } from './Button';
import { ChipGroup } from './Chips';
import { Dialog } from './Dialog';
import { Field } from './Field';
import { ImpactPreview } from './ImpactPreview';
import { MoneyInput } from './MoneyInput';
import { SaveStatus } from './SaveStatus';
import { EmptyState, ErrorState, Loading } from './States';
import { ApiError } from '../../api/client';

describe('Button', () => {
  it('gönderim sürerken kilitlenir; çift tıklama ikinci kez çağırmaz', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Gideri Kaydet</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Gideri Kaydet' }));
    rerender(
      <Button onClick={onClick} loading>
        Gideri Kaydet
      </Button>,
    );
    const busy = screen.getByRole('button', { name: 'Kaydediliyor…' });
    expect(busy).toBeDisabled();
    await userEvent.click(busy);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Field ve MoneyInput', () => {
  function Money() {
    const [value, setValue] = useState('');
    return (
      <Field
        label="Tutar"
        required
        error={value === '12.5' ? 'Ondalık için virgül kullanın' : undefined}
      >
        {(props) => <MoneyInput {...props} value={value} onChange={setValue} />}
      </Field>
    );
  }

  it('etiket, zorunlu yıldız ve sayısal klavye; yazarken binlik ayracı', async () => {
    render(<Money />);
    const input = screen.getByLabelText(/Tutar/);
    expect(input).toHaveAttribute('inputmode', 'decimal');
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText('*')).toHaveClass('field__required');
    await userEvent.type(input, '1250050');
    expect(input).toHaveValue('1.250.050');
  });

  it('hata metni alanın altında ve alana bağlı', async () => {
    render(<Money />);
    const input = screen.getByLabelText(/Tutar/);
    await userEvent.type(input, '12.5');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Ondalık için virgül kullanın');
    expect(input.getAttribute('aria-describedby')).toContain(screen.getByRole('alert').id);
  });
});

describe('ChipGroup', () => {
  it('seçili chip işaretli', async () => {
    const onChange = vi.fn();
    render(
      <ChipGroup
        label="Tür"
        value="expense"
        onChange={onChange}
        options={[
          { value: 'expense', label: 'Gider' },
          { value: 'income', label: 'Gelir' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Gider' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Gelir' }));
    expect(onChange).toHaveBeenCalledWith('income');
  });
});

describe('Dialog', () => {
  it('markalı dialog: odak içeride başlar, Esc kapatır', async () => {
    const onClose = vi.fn();
    render(
      <Dialog
        open
        title="Kaydı sil"
        onClose={onClose}
        actions={<button type="button">Vazgeç</button>}
      >
        <p>Emin misiniz?</p>
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Kaydı sil' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('gönderim sürerken Esc kapatmaz', async () => {
    const onClose = vi.fn();
    render(
      <Dialog open locked title="Kaydediliyor" onClose={onClose}>
        <button type="button">Tamam</button>
      </Dialog>,
    );
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('ImpactPreview', () => {
  it('önce → sonra değerleri ve değişen satırı gösterir', () => {
    render(
      <ImpactPreview
        groups={[
          {
            title: 'Elektrik işi',
            rows: [
              { label: 'Kalan borç', before: 7_500_000, after: 12_000_000 },
              { label: 'Fazla ödeme', before: 0, after: 0 },
            ],
          },
        ]}
      />,
    );
    const row = screen.getByRole('row', { name: /Kalan borç/ });
    expect(row).toHaveTextContent('₺75.000,00');
    expect(row).toHaveTextContent('₺120.000,00');
    expect(row).toHaveTextContent('(değişiyor)');
    expect(screen.getByRole('row', { name: /Fazla ödeme/ })).not.toHaveTextContent('(değişiyor)');
  });
});

describe('SaveStatus', () => {
  it.each([
    [{ status: 'saving' } as const, 'Kaydediliyor', '⏳'],
    [{ status: 'saved' } as const, 'Kaydedildi', '✓'],
    [{ status: 'failed', message: 'Şantiye seçilmeli.' } as const, 'Kaydedilemedi', '✕'],
    [
      { status: 'verifying' } as const,
      'Kaydın durumu doğrulanıyor. Lütfen yeni kayıt açmayın.',
      '↻',
    ],
  ])('%o ayrı metin ve ikonla gösterilir', (state, text, icon) => {
    render(<SaveStatus state={state} onVerify={() => undefined} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(text);
    expect(status).toHaveTextContent(icon);
  });

  it('doğrulanıyor durumunda elle yeniden sorma düğmesi var', async () => {
    const onVerify = vi.fn();
    render(<SaveStatus state={{ status: 'verifying' }} onVerify={onVerify} />);
    await userEvent.click(screen.getByRole('button', { name: 'Durumu şimdi kontrol et' }));
    expect(onVerify).toHaveBeenCalled();
  });
});

describe('Amount', () => {
  it('gelir yeşil, gider kırmızı; iade yazıyla ve eksiyle belirtilir', () => {
    const { container } = render(
      <>
        <Amount value={4_500_000} kind="income" />
        <Amount value={4_500_000} kind="expense" />
        <Amount value={1_000_000} kind="expense_refund" showKind />
      </>,
    );
    const amounts = container.querySelectorAll('.amount');
    expect(amounts[0]).toHaveClass('amount--income');
    expect(amounts[1]).toHaveClass('amount--expense');
    expect(amounts[2]).toHaveClass('amount--expense');
    expect(amounts[2]).toHaveTextContent('−₺10.000,00');
    expect(amounts[2]).toHaveTextContent('Ödeme iadesi');
  });
});

describe('durum bileşenleri', () => {
  it('boş durum başlık, açıklama ve eylem', () => {
    render(
      <EmptyState
        title="Aktif proje bulunamadı"
        description="İlk şantiyeni oluştur"
        actions={<button type="button">Ekle</button>}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Aktif proje bulunamadı' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ekle' })).toBeInTheDocument();
  });

  it('yükleniyor tutar göstermez; hata yeniden dene sunar, erişilemeyen kayıt genel mesaj', async () => {
    const onRetry = vi.fn();
    const { rerender } = render(<Loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Yükleniyor');
    expect(screen.queryByText(/TL|₺/)).toBeNull();
    rerender(
      <ErrorState
        error={new ApiError('network', 'Bağlantı hatası. İnternetinizi kontrol edin.')}
        onRetry={onRetry}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Yeniden dene' }));
    expect(onRetry).toHaveBeenCalled();
    rerender(<ErrorState error={new ApiError('http', 'Kayıt bulunamadı.', 404, 'NOT_FOUND')} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Bu kayda erişilemiyor.');
  });
});
