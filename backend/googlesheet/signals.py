"""
Signal envoyé par sync_sheets une fois les onglets écrits en base (jamais en simulation).

Il laisse aux apps qui calculent sur la copie de la feuille (wealth : devises, total du jour) le soin de se mettre à
jour, sans que googlesheet les connaisse : la dépendance reste dans un seul sens, wealth -> googlesheet.

Arguments : owner (None pour le site, sinon le compte), tabs (onglets enregistrés, éventuellement aucun).
Un receveur peut renvoyer un dictionnaire, fusionné dans SyncResults.computed et renvoyé avec la synchronisation.
Une erreur d'un receveur n'est pas rattrapée (send, pas send_robust) : à lui de garder ce qui doit l'être.
"""
from django.dispatch import Signal

tables_synced = Signal()
