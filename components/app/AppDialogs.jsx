'use client'

import { DOSE_REMINDERS_ENABLED } from '@/lib/doses'
import SettingsSheet from '@/components/SettingsSheet'
import GuidedTour from '@/components/GuidedTour'
import { appNeedsUpdate, isNativeApp } from '@/lib/notifications'
import { DosesSheet } from '@/components/app/DosesSheet'
import { TravelListDialog } from '@/components/app/TravelListDialog'
import { AddMedicineDialog } from '@/components/app/AddMedicineDialog'
import { MedicineDetailSheet } from '@/components/app/MedicineDetailSheet'
import { FamilyDialog } from '@/components/app/FamilyDialog'
import { AccountDialog } from '@/components/app/AccountDialog'
import { AIAssistantSheet } from '@/components/app/AIAssistantSheet'

export function AppDialogs({ accountOpen, addOpen, aiOpen, askNotificationPermission, detailMed, dosesOpen, editMed, familyOpen, finishTour, handleDelete, handleQuickQuantity, lastSync, loadAll, medicines, nextReminder, notifPermission, notifPrefs, setAccountOpen, setAddOpen, setAiOpen, setDetailMed, setDosesOpen, setEditMed, setFamilyOpen, setMedicines, setSettingsOpen, setStats, setTravelOpen, setUser, settingsOpen, startTour, syncNow, syncing, testNotification, tourOpen, travelOpen, updateNotifPrefs, user }) {
  return (
    <>
        {addOpen && (
          <AddMedicineDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            onSaved={loadAll}
            onOpenExisting={(m) => setDetailMed(m)}
          />
        )}
        {editMed && (
          <AddMedicineDialog
            open={!!editMed}
            onOpenChange={(o) => !o && setEditMed(null)}
            onSaved={loadAll}
            editMed={editMed}
          />
        )}
        {detailMed && (
          <MedicineDetailSheet
            med={detailMed}
            onClose={() => setDetailMed(null)}
            onDelete={() => handleDelete(detailMed.id)}
            onQty={(d) => handleQuickQuantity(detailMed, d)}
            onEdit={() => { const m = detailMed; setDetailMed(null); setEditMed(m) }}
          />
        )}
        {aiOpen && <AIAssistantSheet open={aiOpen} onOpenChange={setAiOpen} />}
        {familyOpen && (
          <FamilyDialog
            open={familyOpen}
            onOpenChange={setFamilyOpen}
            currentEmail={user.email}
            onChanged={() => { loadAll() }}
          />
        )}
        {DOSE_REMINDERS_ENABLED && (
          <DosesSheet open={dosesOpen} onOpenChange={setDosesOpen} medicines={medicines} onChanged={() => { loadAll() }} />
        )}
        {travelOpen && <TravelListDialog open={travelOpen} onOpenChange={setTravelOpen} medicines={medicines} />}
        <GuidedTour open={tourOpen} onFinish={finishTour} />
        <SettingsSheet
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          prefs={notifPrefs}
          onChange={updateNotifPrefs}
          permission={notifPermission}
          onRequestPermission={askNotificationPermission}
          onSendTest={testNotification}
          nextReminder={nextReminder}
          native={isNativeApp()}
          needsUpdate={appNeedsUpdate()}
          lastSync={lastSync}
          syncing={syncing}
          onSync={syncNow}
          onStartTour={startTour}
        />
        {accountOpen && (
          <AccountDialog
            open={accountOpen}
            onOpenChange={setAccountOpen}
            user={user}
            onGone={() => { setUser(null); setMedicines([]); setStats({ total: 0, expired: 0, expiring: 0, low_stock: 0, categories: {}, last_added: [] }) }}
          />
        )}
    </>
  )
}
