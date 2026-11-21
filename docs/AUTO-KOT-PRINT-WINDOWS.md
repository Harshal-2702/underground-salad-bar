# Windows silent KOT printing setup

This setup enables silent printing from the Kitchen OS Admin page using the existing Windows printer driver. It does not install a cloud printer service and does not change customer checkout or server-side order handling.

## 1. Set the DCode printer as the Windows default

1. Connect and power on the DCode DCRP30.
2. In Windows, open **Settings → Bluetooth & devices → Printers & scanners**.
3. Open **DCode DCRP30** and choose **Set as default**.
4. Turn off **Let Windows manage my default printer** on the Printers & scanners page, if that option is enabled.
5. Print a Windows test page and confirm that the correct roll width and orientation are selected in the DCode driver.

Chrome kiosk printing sends all print jobs from that Chrome instance to the Windows default printer without showing the print dialog. Do not use this dedicated browser shortcut for normal browsing or documents you expect to inspect before printing.

## 2. Create a dedicated Chrome shortcut

1. Close every Chrome window. In the system tray, also exit Chrome if it is still running.
2. Create a folder named `C:\UKOS-Kiosk-Chrome`.
3. Right-click the desktop → **New → Shortcut**.
4. For the shortcut target, use the following command. Replace `https://kitchen.undergroundsaladbar.in` with the actual Kitchen OS Admin URL:

```text
"C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="C:\UKOS-Kiosk-Chrome" --kiosk-printing <ADMIN-URL>
```

If Chrome is installed in a different location, browse to its actual `chrome.exe` path and keep both command-line switches.

5. Name the shortcut **Kitchen OS – Silent Printing**.
6. Launch Chrome using this shortcut only for the kitchen station.
7. Sign in to Kitchen OS Admin in this separate Chrome profile. Keep the regular Chrome profile for normal browsing.

## 3. Enable and test from Kitchen OS

1. Open **Kitchen Orders → Design KOT**.
2. Save the KOT template at **80mm** paper width.
3. Switch **Auto-print** ON. The setting is saved in this browser profile.
4. Choose **Print sample KOT silently**.
5. Confirm that the DCode DCRP30 prints the sample without showing the browser print dialog.
6. Only after the sample prints correctly, use a clearly labelled test order and click **Accept**. Its KOT should print automatically.

## Important behaviour

- The automatic trigger is **staff acceptance**, not order arrival. New orders remain visible for review and will not print until staff accepts them.
- The automatic print ID is saved locally in this browser profile to prevent repeat printing when the order list refreshes or React re-renders. The list is capped at the most recent 500 printed order IDs.
- The existing **Print KOT** button remains available as a manual action. In the dedicated kiosk profile, Chrome sends it directly to the default printer too.
- The Auto-print switch is local to this browser profile and starts OFF on other profiles/devices.
- If the printer is offline, Windows may queue or fail the job. A browser print call confirms that the job was sent to the OS, not that paper physically emerged. Check the printer and Windows queue during the first test.
- Chrome kiosk printing affects every print command issued by that dedicated Chrome instance. That is why the separate `C:\UKOS-Kiosk-Chrome` profile and shortcut are recommended.
- Turning Auto-print OFF stops future automatic jobs. It does not retract jobs already sent to Windows.
